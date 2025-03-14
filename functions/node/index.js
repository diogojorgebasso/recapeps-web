const { getFirestore } = require("firebase-admin/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const sgMail = require("@sendgrid/mail");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onObjectFinalized } = require("firebase-functions/v2/storage");
const speech = require('@google-cloud/speech').v2;

require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = getFirestore();

exports.saveRoleToFirestore = functions.auth.user().onCreate(async (user) => {
  try {
    const { uid, email, displayName, photoURL } = user;
    const role = email && email.endsWith("@recapeps.com") ? "admin" : "user";

    const userData = {
      uid,
      email: email || null,
      name: displayName || null,
      photoURL: photoURL || null,
      emailNotifications: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      role,
    };

    await db.collection("users").doc(uid).set(userData);
    logger.info(`User ${uid} saved to Firestore successfully.`);

    await admin.auth().setCustomUserClaims(uid, { role });
    logger.info(`Role ${role} saved to user ${uid} successfully.`);
  } catch (error) {
    logger.error("Error saving user to Firestore:", error);
  }
}
);

exports.deleteUserDocument = functions.auth.user().onDelete(async (user) => {
  console.log("Deleting user data:", user.uid);
  const userUid = user.uid;
  const userDocRef = db.collection("users").doc(userUid);

  try {
    const docSnapshot = await userDocRef.get();

    // Stripe deletion logic
    if (docSnapshot.exists) {
      if (docSnapshot.data().stripeCustomerId) {
        const stripeCustomerId = docSnapshot.data().stripeCustomerId;
        const subscriptions = await stripe.subscriptions.list({
          customer: stripeCustomerId,
          status: "all",
        });
        for (let subscription of subscriptions.data) {
          if (subscription.status !== "canceled") {
            await stripe.subscriptions.del(subscription.id);
            logger.info(
              `Cancelled subscription ${subscription.id} for user ${userUid}.`
            );
          }
        }
        await stripe.customers.del(stripeCustomerId);
        logger.info(
          `Stripe customer ${stripeCustomerId} deleted for user ${userUid}.`
        );
      }
      await userDocRef.delete();
      logger.info(`User ${userUid} deleted from Firestore successfully.`);
    } else {
      logger.info(`No Stripe customer ID found for user ${userUid}.`);
    }

    const userFolderRef = admin.storage().bucket().file(`user/${userUid}`);
    const [exists] = await userFolderRef.exists();
    if (exists) {
      await userFolderRef.delete();
      logger.info(
        `User folder user/${userUid} deleted from Storage successfully.`
      );
    }
  } catch (error) {
    logger.error("Error deleting user data:", error);
  }
});

exports.createStripeCheckoutSession = onRequest(
  { cors: "https://recapeps.fr" },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ data: { error: "Method Not Allowed" } });
      return;
    }

    // Authentication check
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.split("Bearer ")[1] : null;

    if (!token) {
      res.status(401).json({ error: "Unauthenticated request. Token missing." });
      return;
    }

    let userId;
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      userId = decodedToken.uid;
    } catch (error) {
      res.status(401).json({ error: "Invalid authentication token." });
      return;
    }
    logger.info(`User ${userId} authenticated successfully.`);

    // Extract priceId and quantity from request body
    const { priceId } = req.body.data || {};

    if (!priceId) {
      res.status(400).json({ error: "Invalid subscription data. priceId is required." });
      return;
    }

    try {
      // Retrieve or create a Stripe customer
      let customer;
      const userDoc = await db.collection("users").doc(userId).get();

      if (userDoc.exists && userDoc.data().stripeCustomerId) {
        logger.info(`Customer found for user ${userId}.`);
        customer = userDoc.data().stripeCustomerId;
      } else {
        logger.info(`Creating customer for user ${userId}.`);
        const customerData = await stripe.customers.create({
          email: userDoc.data().email,
          name: userDoc.data().name,
          metadata: { firebaseUID: userId },
        });
        customer = customerData.id;
        await db.collection("users").doc(userId).update({ stripeCustomerId: customer });
      }

      // Create a Stripe Checkout Session for a subscription
      const session = await stripe.checkout.sessions.create({
        customer, // Link to the Stripe customer
        payment_method_types: ["card"],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: "https://recapeps.fr/success?session_id={CHECKOUT_SESSION_ID}",
        cancel_url: "https://recapeps.fr/cancel",
        metadata: { firebaseUID: userId },
      });

      logger.info(`Checkout session created for user ${userId}: ${session.id}`);

      // Return the session ID to the frontend
      res.status(200).json({ data: { id: session.id } });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ data: { error: "Failed to create checkout session." } });
    }
  }
);

exports.stripeWebhook = onRequest({ rawBody: true }, async (req, res) => {
  try {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    // Check if webhook secret is configured
    if (!webhookSecret) {
      throw new Error("Webhook secret not configured");
    }

    // Construct the Stripe event using the raw body
    const event = stripe.webhooks.constructEvent(
      req.rawBody,
      sig,
      webhookSecret
    );

    logger.debug(`Received event: ${event.type}`);

    // Handle customer.subscription.updated event
    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object;
      const subscriptionId = subscription.id;
      const stripeCustomerId = subscription.customer;
      logger.debug(`Subscription ${subscriptionId} updated for user ${stripeCustomerId}`);
      const userSnapshot = await db.collection("users").where("stripeCustomerId", "==", stripeCustomerId).get();

      if (userSnapshot.empty) {
        logger.error(`No user found for Stripe customer ID ${stripeCustomerId}`);
        res.status(404).send("User not found");
        return;
      }

      const userId = userSnapshot.docs[0].id;
      const subscriptionRef = db
        .collection("users")
        .doc(userId)
        .collection("subscriptions")
        .doc(subscriptionId);

      logger.debug("Starting to update subscription.");

      await subscriptionRef.set(subscription, { merge: true });
      logger.info(`Subscription ${subscriptionId} updated successfully`);
      res.status(200).send("Webhook received");
    }
    else {
      // Acknowledge unhandled event types
      res.status(200).send("Event type not handled");
    }
  } catch (error) {
    logger.error("Webhook error:", error.message);
    if (!res.headersSent) {
      res.status(400).send(`Webhook Error: ${error.message}`);
    }
  }
});

// create the Billing Portal for the especified user.
exports.createPortalSession = onRequest(
  { cors: "https://recapeps.fr" },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ data: { error: "Method Not Allowed" } });
      return;
    }

    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.split("Bearer ")[1]
      : null;

    if (!token) {
      res.status(401).json({ data: { error: "Unauthenticated request" } });
      return;
    }

    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      const userId = decodedToken.uid;

      // Retrieve Stripe customer ID from Firestore
      const userDoc = await db.collection("users").doc(userId).get();
      const stripeCustomerId = userDoc.data()?.stripeCustomerId;

      if (!stripeCustomerId) {
        logger.error(`Customer not found for user ${userId}`);
        res.status(404).json({ data: { error: "Customer not found" } });
        return;
      }

      // Create portal session
      const session = await stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: "https://recapeps.fr/profil",
      });
      logger.info(`Portal session created: ${session.id} ${session.url}`);
      res.status(200).json({ data: { url: session.url } });
    } catch (error) {
      logger.error("Error creating portal session:", error);
      res.status(500).json({ data: { error: "Internal server error" } });
    }
  }
);

exports.sendContactEmail = onDocumentCreated("contact/{contactID}",
  async (event) => {
    const snapshot = event.data;

    if (!snapshot) {
      logger.error("No data associated with the event");
      return;
    }

    const data = snapshot.data();
    const userEmail = data?.email;
    const userName = data?.name || "";

    const emailToUser = {
      to: userEmail,
      from: "no-reply@recapeps.fr",
      cc: "support@recapeps.fr",
      subject: `Confirmation de réception de votre message`,
      text: `Bonjour ${userName},\n\nNous avons bien reçu votre message, nous y répondrons dans les meilleurs délais.\n\nMerci pour votre confiance,\nL'équipe Recapeps.`
    };

    try {
      if (userEmail) {
        await sgMail.send(emailToUser);
      }
      logger.info("Emails enviados com sucesso para o contato e suporte.");
    } catch (error) {
      logger.error("Erro ao enviar emails via SendGrid:", error);
    }
  })

// Export User Data Function
exports.exportUserData = onRequest({ cors: ["https://recapeps.fr"] }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.split("Bearer ")[1]
    : null;

  if (!token) {
    res.status(401).json({ error: "Unauthenticated request" });
    return;
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    const userId = decodedToken.uid;
    logger.info(`Exporting data for user ${userId}`);

    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const userData = {};
    const userEmail = userDoc.data().email;

    if (!userEmail) {
      res.status(400).json({ error: "User email not found" });
      return;
    }

    userData.profile = userDoc.data();

    // Subscriptions
    const subscriptionsSnapshot = await db.collection("users").doc(userId).collection("subscriptions").get();
    if (!subscriptionsSnapshot.empty) {
      userData.subscriptions = subscriptionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    }

    // Quizzes
    const quizzesSnapshot = await db.collection("users").doc(userId).collection("quizzes").get();
    if (!quizzesSnapshot.empty) {
      userData.quizzes = quizzesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    }

    // Prepare email
    const emailData = {
      to: userEmail,
      from: "no-reply@recapeps.fr",
      subject: "Votre export de données RecapEPS",
      text: "Veuillez trouver ci-joint l'export de vos données RecapEPS.",
      html: `
          <p>Bonjour ${userData.profile.name || ""},</p>
          <p>Vous avez demandé un export de vos données personnelles sur RecapEPS.</p>
          <p>Vos données sont disponibles en pièce jointe à cet email.</p>
          <p>Cordialement,<br>L'équipe RecapEPS</p>`,
      attachments: [
        {
          filename: 'recapeps-data-export.json',
          content: Buffer.from(JSON.stringify(userData, null, 2)).toString('base64'),
          type: 'application/json',
          disposition: 'attachment'
        }
      ]
    };

    await sgMail.send(emailData);
    logger.info(`Data export email sent to user ${userId} at ${userEmail}`);

    res.status(202).json({ message: "Export request accepted and processing" });
  } catch (error) {
    logger.error("Error exporting user data:", error);
    res.status(500).json({ error: "Failed to export user data" });
  }
});

// Transcribe Uploaded Document Function
exports.transcribeUploadedDocument = onObjectFinalized(async (event) => {
  const filePath = event.data.name;
  const pathMatch = filePath.match(/^user\/(.*?)\/transcripts\/(.*?)$/);
  const speechClient = new speech.SpeechClient();

  if (!pathMatch) {
    logger.info(`File ${filePath} does not match the target path pattern. Skipping.`);
    return;
  }

  const userId = pathMatch[1];
  const documentId = pathMatch[2];
  const bucketName = event.data.bucket;
  const gcsUri = `gs://${bucketName}/${filePath}`;

  logger.info(`Processing transcription for user ${userId}, document ${documentId}`);

  try {
    const bucket = admin.storage().bucket(bucketName);
    const file = bucket.file(filePath);
    const [metadata] = await file.getMetadata();
    const contentType = metadata.contentType;

    let transcriptionText = "";

    if (contentType.startsWith('audio/') || contentType.startsWith('video/')) {
      const request = {
        recognizer: `projects/recapeps-platform/locations/global/recognizers/_`,
        config: {
          languageCodes: ["fr-FR"],
          model: "latest_long",
          profanityFilter: true,
          autoDecodingConfig: {}
        },
        uri: gcsUri,
      };

      logger.info(`Sending recognition request for ${gcsUri}`);
      const [response] = await speechClient.recognize(request);

      if (response.results && response.results.length > 0) {
        transcriptionText = response.results
          .map(result => result.alternatives[0].transcript)
          .join(" ")
          .trim();
      }
      logger.info("Audio transcription completed successfully");
    } else {
      logger.warn(`Unsupported file type for transcription: ${contentType}`);
      transcriptionText = "Unsupported file type";
    }

    // Save to Firestore
    const docRef = db.collection("users").doc(userId).collection("transcripts").doc(documentId);
    await docRef.set({
      transcription: transcriptionText,
      originalFile: filePath,
      contentType: contentType,
      fileSize: metadata.size,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    logger.info(`Transcription saved successfully for user ${userId}, document ${documentId}`);
  } catch (error) {
    logger.error(`Error transcribing document ${filePath}:`, error);
  }
});
