import { useState } from "react";
import { getDownloadURL, ref } from "firebase/storage";
import { storage } from "@/utils/firebase";
import { Button } from "@/components/ui/button";

export default function Notes() {
    const filePath = "/mixite/mixite_sexuee.pdf";
    const [loading, setLoading] = useState(false);

    const handleButtonClick = async (filepath: string) => {
        setLoading(true);

        try {
            const fileRef = ref(storage, filepath);
            const url = await getDownloadURL(fileRef);
            window.open(url, "_blank");
        } catch (error) {
            console.error("Erro ao obter o PDF:", error);
        }
        finally {
            setLoading(false);
        }
    };


    return (
        <div>
            <title>Notes</title>
            <Button onClick={() => handleButtonClick(filePath)}>
                {loading ? "Carregando..." : "Abrir PDF"}
            </Button>
        </div>
    )
}