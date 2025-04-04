import { useEffect, useState } from "react";
import { Subject } from "@/types/Subject";
import {
    Box,
    Card,
    SimpleGrid,
    Image,
    Button,
} from "@chakra-ui/react";
import { Link } from "react-router";
import { Toaster, toaster } from "@/components/ui/toaster"
import { getSubjectsFlashcards } from "@/api/getSubjectsFlashcards";
import {
    DialogActionTrigger,
    DialogBody,
    DialogCloseTrigger,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogRoot,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { useSubscription } from "@/hooks/useSubscription";


export default function Home() {
    const { isSubscribed } = useSubscription();

    const [subjects, setSubjects] = useState<Subject[]>([]);

    useEffect(() => {
        const loadSubjects = async () => {
            const allSubjects = await getSubjectsFlashcards();
            setSubjects(allSubjects)
            if (allSubjects.length == 0) {
                toaster.create({
                    title: "Erreur innatendue",
                    description: "Nous rencontrons des difficultés avec notre serveur, veuillez recharger la page",
                    type: "error"
                })
            }
        }
        loadSubjects();

    }, []);


    return (
        <Box>
            <Toaster />
            <Box mb="12">
                <SimpleGrid columns={[1, 2, 3]} gap="6">
                    {subjects.map(({ id, name, image, premium }) => (
                        <ExamCard
                            key={id}
                            id={id}
                            name={name}
                            image={image}
                            premium={premium}
                            isUserPremium={isSubscribed}
                        />
                    ))}
                </SimpleGrid>
            </Box>
        </Box >
    );
}

function ExamCard({
    id,
    name,
    image,
    premium,
    isUserPremium
}: {
    id: string;
    name: string;
    image: string;
    premium: boolean;
    isUserPremium: boolean;
}) {
    if (isUserPremium) {
        return (
            <Card.Root maxW="sm" overflow="hidden" borderWidth="1px" borderRadius="lg" shadow="md">
                <Image src={image} alt={name} h="200px" w="full" />
                <Card.Body gap="2" p="4">
                    <Card.Title>{name}</Card.Title>
                </Card.Body>
                <Card.Footer gap="2" p="4">
                    <Button variant="solid">
                        <Link to={`/flashcards/${id}`}>Voir plus</Link>
                    </Button>
                </Card.Footer>
            </Card.Root>
        );
    }
    else {
        return (
            <Card.Root maxW="sm" overflow="hidden" borderWidth="1px" borderRadius="lg" shadow="md">
                <Image src={image} alt={name} h="200px" w="full" />
                <Card.Body gap="2" p="4">
                    <Card.Title>{name} {premium ? "🔒" : ""}</Card.Title>
                </Card.Body>
                <Card.Footer gap="2" p="4">
                    {premium ?
                        <DialogRoot>
                            <DialogTrigger asChild>
                                <Button size="sm">
                                    Voir plus
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Passer à Recap’eps pro?</DialogTitle>
                                </DialogHeader>
                                <DialogBody>
                                    <p>
                                        Tu apprécies le contenu que nous te proposons mais tu restes sur ta faim? Tu  aimerai accéder à tout le contenu que nous t’avons concocté? Alors n’hésite plus et passe à Recap’eps pro ! 🎯
                                    </p>
                                </DialogBody>
                                <DialogFooter>
                                    <DialogActionTrigger asChild>
                                        <Button variant="outline">Non, merci</Button>
                                    </DialogActionTrigger>
                                    <Button variant="solid">
                                        <Link to="/checkout">Oui par pitié</Link>
                                    </Button>
                                </DialogFooter>
                                <DialogCloseTrigger />
                            </DialogContent>
                        </DialogRoot>
                        :
                        <Button variant="solid">
                            <Link to={`/flashcards/${id}`}>Voir plus</Link>
                        </Button>}
                </Card.Footer>
            </Card.Root>
        );
    }
}
