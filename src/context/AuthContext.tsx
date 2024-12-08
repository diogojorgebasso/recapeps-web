/* eslint-disable react-refresh/only-export-components */
import {
    getIdToken,
    onAuthStateChanged,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signOut,
    signInWithPopup,
    createUserWithEmailAndPassword,
    GoogleAuthProvider,
    User,
} from "firebase/auth";
import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { ReactNode } from "react";
import { auth } from "@/utils/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/utils/firebase"; // Firestore instance

type AuthContextProps = {
    name: string;
    uid: string;
    isAuthenticated: boolean;
    isLoadingAuth: boolean;
    email: string;
    photoURL: string;
    currentUser: User | null;
    role: string;
    loginWithEmailAndPassword: (email: string, password: string) => Promise<void>;
    loginWithGoogle: () => Promise<void>;
    signUpWithEmailAndPassword: (email: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
    getUserToken: () => Promise<string>;
    handleRecoverPassword: (email: string) => Promise<void>;
};

export const AuthContext = createContext({} as AuthContextProps);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [name] = useState("student");
    const [uid, setUid] = useState("");
    const [email, setEmail] = useState("");
    const [isLoadingAuth, setIsLoadingAuth] = useState(true);
    const [photoURL, setPhotoURL] = useState("/avatar.svg");
    const [role, setRole] = useState("user");

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user && user.uid) {
                setUid(user.uid);
                setEmail(user.email!);
                if (user.photoURL) {
                    setPhotoURL(user.photoURL);
                }
                await fetchUserRole(user); // Fetch the user's role
                setIsLoadingAuth(false);
            } else {
                setUid("");
                setRole("user");
            }
        });
        return unsubscribe;
    }, []);

    const fetchUserRole = async (user: User) => {
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                if (userData.role && typeof userData.role === "string") {
                    setRole(userData.role); // Ensure the role is a string
                }
            }
        } catch (error) {
            console.error("Error fetching user role:", error);
        }
    };

    const loginWithEmailAndPassword = useCallback(async (email: string, password: string) => {
        await signInWithEmailAndPassword(auth, email, password);
    }, []);

    const loginWithGoogle = useCallback(async () => {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
    }, []);

    const signUpWithEmailAndPassword = useCallback(async (email: string, password: string) => {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const { user } = userCredential;

            // Save the user to Firestore
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                email: user.email,
                name: user.displayName || null,
                photoURL: user.photoURL || null,
                createdAt: new Date().toISOString(),
            });
        } catch (error) {
            console.error("Error during sign-up:", error);
            throw error;
        }
    }, []);

    const signOutFn = useCallback(() => signOut(auth), []);

    const handleRecoverPassword = useCallback(async (email: string) => {
        await sendPasswordResetEmail(auth, email);
    }, []);

    // Get user token
    const getUserToken = useCallback(async () => {
        if (auth.currentUser) {
            return await getIdToken(auth.currentUser);
        }
        return "";
    }, []);

    // Check if user is authenticated
    const isAuthenticated = useMemo(() => Boolean(uid), [uid]);

    return (
        <AuthContext.Provider
            value={{
                name,
                uid,
                isAuthenticated,
                isLoadingAuth,
                email,
                photoURL,
                currentUser: auth.currentUser,
                role, // Provide role in the context
                loginWithEmailAndPassword,
                loginWithGoogle,
                signUpWithEmailAndPassword, // Add sign-up functionality
                signOut: signOutFn,
                getUserToken,
                handleRecoverPassword,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}
