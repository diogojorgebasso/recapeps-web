import React, { useState } from "react";
import Cropper, { Area } from "react-easy-crop";
import {
    Box,
    Button,
    Fieldset,
    Flex,
    Heading,
    HStack,
    Input,
    Text,
    VStack,
} from "@chakra-ui/react";
import { Checkbox } from "@/components/ui/checkbox";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFirestore, doc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router";
import { Avatar } from "@/components/ui/avatar";
import {
    DialogBody,
    DialogTrigger,
    DialogActionTrigger,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogRoot,
    DialogCloseTrigger,
} from "@/components/ui/dialog"
import { Field } from "@/components/ui/field";
import { Toaster, toaster } from "@/components/ui/toaster"

import {
    FileUploadRoot,
    FileUploadTrigger,
} from "@/components/ui/file-upload"
import { HiUpload } from "react-icons/hi";
import { PasswordInput } from "@/components/ui/password-input";

export default function Profil() {
    const { photoURL, firstName, secondName,
        updatePhotoURLInContext, uid, subscribed, email,
        handleEmailChange, updateUserName, deleteUserAccount,
        isEmailNotificationEnabled, updateEmailNotificationPreference } = useAuth();
    const [newEmailNotification, setNewEmailNotification] = useState(isEmailNotificationEnabled);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [isUploading, setIsUploading] = useState(false);
    const [openDialog, setOpenDialog] = useState(false)
    const [newEmail, setNewEmail] = useState(email);
    const [newFirstName, setNewFirstName] = useState(firstName)
    const [newSecondName, setNewSecondName] = useState(secondName)
    const [currentPassword, setCurrentPassword] = useState("")

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            setSelectedFile(event.target.files[0]);
        }
        setOpenDialog(true);
    };

    const onCropComplete = (_croppedArea: Area, croppedPixels: { x: number; y: number; width: number; height: number }) => {
        setCroppedAreaPixels(croppedPixels);
    };

    const uploadImage = async () => {
        if (!selectedFile || !croppedAreaPixels) return;

        setIsUploading(true);
        const canvas = document.createElement("canvas");
        const image = new Image();
        image.src = URL.createObjectURL(selectedFile);
        await new Promise((resolve) => (image.onload = resolve));

        canvas.width = croppedAreaPixels.width;
        canvas.height = croppedAreaPixels.height;

        const ctx = canvas.getContext("2d");
        if (ctx) {
            ctx.drawImage(
                image,
                croppedAreaPixels.x,
                croppedAreaPixels.y,
                croppedAreaPixels.width,
                croppedAreaPixels.height,
                0,
                0,
                croppedAreaPixels.width,
                croppedAreaPixels.height
            );
        }

        const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, "image/jpeg")
        );

        if (!blob) {
            alert("Falha ao criar a imagem cortada.");
            return;
        }

        const storage = getStorage();
        const storageRef = ref(storage, `user/${uid}/profile.jpg`);

        await uploadBytes(storageRef, blob);
        const downloadURL = await getDownloadURL(storageRef);

        const firestore = getFirestore();
        const userRef = doc(firestore, "users", uid);
        await updateDoc(userRef, { photoURL: downloadURL });

        await updatePhotoURLInContext(downloadURL);
        setIsUploading(false);
        setOpenDialog(false);
        toaster.create({
            title: "Photo de profil mise à jour",
            type: "success",
            description: "Votre photo de profil a été mise à jour avec succès.",
        })
    };

    const handleUserChange = async () => {
        setIsUploading(true);
        await updateUserName(newFirstName, newSecondName);
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (newEmail != email && emailRegex.test(newEmail)) {
            await handleEmailChange(currentPassword, email);
        }
        setIsUploading(false);
        toaster.create({
            title: "Profil mise à jour",
            type: "success",
            description: "Votre profil a été mise à jour avec succès.",
        })
    }

    return (
        <Box p={6}>
            <Toaster />
            <Heading as="h2" size="lg" mb={6}>
                Profil
            </Heading>
            <Flex gap={10}>
                <VStack gap={4} >
                    <Box w="200px" h="200px">
                        <Avatar size="full" name="Profile Photo" src={photoURL} />
                    </Box>
                    <FileUploadRoot onChange={handleFileChange}>
                        <FileUploadTrigger>
                            <Button>
                                <HiUpload /> Changez votre photo de profil
                            </Button>
                        </FileUploadTrigger>
                    </FileUploadRoot>
                    <DialogRoot lazyMount open={openDialog} size="xl">
                        <DialogContent>
                            <DialogHeader>Crop photo</DialogHeader>
                            <DialogBody>
                                {selectedFile && (
                                    <Box position="relative" width="100%" height="400px">
                                        <Cropper
                                            image={URL.createObjectURL(selectedFile)}
                                            crop={crop}
                                            zoom={zoom}
                                            aspect={1}
                                            onCropChange={setCrop}
                                            onZoomChange={setZoom}
                                            onCropComplete={onCropComplete}
                                        />
                                    </Box>
                                )}
                            </DialogBody>
                            <DialogFooter>
                                <DialogActionTrigger asChild>
                                    <Button variant="ghost" mr={3}>
                                        Annuler
                                    </Button>
                                </DialogActionTrigger>
                                {isUploading ?
                                    <Text>Enregistrement...</Text>
                                    :
                                    <Button colorScheme="blue" onClick={uploadImage}>
                                        Enregistrer
                                    </Button>}
                            </DialogFooter>
                        </DialogContent>
                    </DialogRoot>
                </VStack>

                <VStack>
                    <Fieldset.Root>
                        <Fieldset.Content>
                            <HStack>
                                <Field label="Prénom">
                                    <Input onChange={e => setNewFirstName(e.target.value)} value={newFirstName} />
                                </Field>
                                <Field label="Nom">
                                    <Input onChange={e => setNewSecondName(e.target.value)} value={newSecondName} />
                                </Field>
                            </HStack>
                            <PasswordInput onChange={e => setCurrentPassword(e.target.value)} value={currentPassword} />
                            <Field errorText="Vous besoin de ecrire ton mot de passe actuel" label="Adresse Email">
                                <Input onChange={(e) => setNewEmail(e.target.value)} value={newEmail} />
                            </Field>
                            <Field label="Nouveau Mot de Passe">
                                <Input autoComplete="new-password" type="password" placeholder="Nouveau mot de passe" />
                            </Field>
                        </Fieldset.Content>
                        <DialogRoot placement="top">
                            <DialogTrigger>
                                <Button disabled={isUploading} onClick={() => handleUserChange()}>
                                    Enregistrer
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>Confirmation</DialogHeader>
                                <DialogBody>
                                    <Text>
                                        Si'l vous plait, confirmez votre email.
                                    </Text>
                                </DialogBody>
                                <DialogFooter>
                                </DialogFooter>
                                <DialogCloseTrigger />
                            </DialogContent>
                        </DialogRoot>
                    </Fieldset.Root>
                </VStack>
            </Flex>


            <Box mt={8}>
                <Heading as="h3" size="md" mb={4}>
                    Préférences Email
                </Heading>
                <VStack align="start" gap={2}>
                    <Checkbox checked={newEmailNotification} onCheckedChange={() => {
                        setNewEmailNotification(!newEmailNotification)
                        updateEmailNotificationPreference(!newEmailNotification)
                        toaster.create({
                            title: "Préférence de notification mise à jour",
                            type: "success",
                            description: "Vos préférences de notification ont été mises à jour avec succès.",
                        })
                    }}>Recevoir des notifications</Checkbox>
                </VStack>
            </Box>

            <Box mt={8}>
                <Heading as="h3" size="md" mb={4}>
                    Confidentialité
                </Heading>
                <Text>
                    Vous pouvez consulter nos{" "}
                    <Link color="blue.500" to="/termes-et-condition">
                        termes et conditions
                    </Link>
                    .
                </Text>
            </Box>

            <Box mt={8}>
                <Heading as="h3" size="md" mb={4}>
                    Historique des Achats
                </Heading>
                {subscribed ? (
                    <VStack align="start">
                        <Text>
                            Abonnement: <strong>Premium (Actif)</strong>
                        </Text>
                        <Text>
                            Dernier achat: <strong>10 décembre 2024</strong>
                        </Text>
                    </VStack>
                ) : (
                    <Button asChild>
                        <Link to="/checkout">Je voudrais profiter de Pro</Link>
                    </Button>
                )}
            </Box>

            <Box>
                <Heading as="h3" size="md" mb={4}>
                    Supprimer le Compte
                </Heading>
                <Text>
                    Vous pouvez supprimer votre compte à tout moment. Veuillez noter que
                    cette action est irréversible.
                </Text>
                <Button colorPalette="red" onClick={() => deleteUserAccount(currentPassword)}>Supprimer le Compte</Button>
            </Box>
        </Box >
    );
}