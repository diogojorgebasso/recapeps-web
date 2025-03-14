import { useState } from "react";
import { Button, Input, Text } from "@chakra-ui/react";
import {
    DialogRoot,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogBody,
    DialogFooter,
    DialogCloseTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router";

export default function DeleteAccountDialog() {
    const { deleteUserAccount, currentUser } = useAuth();
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const hasPasswordProvider = currentUser?.providerData.some(
        (provider) => provider.providerId === "password"
    );

    const handleDelete = async () => {
        setLoading(true);
        setError(null);
        try {
            await deleteUserAccount(password);
            navigate("/");
            return;
        } catch (err) {
            setError("Erreur en suprimant le compte. Veuillez réessayer.");
        }
        setLoading(false);
    };

    return (
        <DialogRoot>
            <DialogTrigger asChild>
                <Button colorPalette="red">Supprimer le compte</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>Suppression du compte</DialogHeader>
                <DialogBody>
                    <Text mb={4}>
                        Êtes-vous sûr de vouloir supprimer votre compte? Cette action est irréversible.
                    </Text>
                    {hasPasswordProvider && (
                        <Input
                            mb={2}
                            type="password"
                            placeholder="Mot de passe"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />)}
                    {error && <Text color="red.500">{error}</Text>}
                </DialogBody>
                <DialogFooter>
                    <Button variant="ghost" mr={3}>
                        Annuler
                    </Button>
                    <Button colorPalette="red" onClick={handleDelete} loading={loading}>
                        Confirmer
                    </Button>
                </DialogFooter>
                <DialogCloseTrigger />
            </DialogContent>
        </DialogRoot>
    );
}