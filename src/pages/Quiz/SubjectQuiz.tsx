import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { fetchQuizzesBySubject } from "@/api/getQuizzesFromFirebase";
import { Quiz } from "@/types/Quiz";
import { saveUserQuiz } from "@/api/saveQuizToFirebase";
import { useAuth } from "@/hooks/useAuth";
import { ProgressBar, ProgressRoot } from "@/components/ui/progress";

import {
    Box,
    Button,
    Card,
    Heading,
    Text,
    Badge,
    Stack,
    Center,
} from "@chakra-ui/react";

export default function QuizPage() {
    const router = useParams();
    const navigate = useNavigate();
    const { subjectId } = router;

    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [score, setScore] = useState(0);
    const [isFinished, setIsFinished] = useState(false);
    const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
    const [showFeedback, setShowFeedback] = useState(false);

    const { currentUser } = useAuth();

    useEffect(() => {
        const loadQuiz = async () => {
            if (subjectId && currentUser) {
                const fetchedQuizzes = await fetchQuizzesBySubject(subjectId, currentUser.uid);
                setQuizzes(fetchedQuizzes);
            }
        };
        loadQuiz();
    }, [subjectId]);

    useEffect(() => {
        const saveQuizIfFinished = async () => {
            if (isFinished && subjectId) {
                const result = {
                    subjectId: subjectId,
                    score: score,
                    totalQuestions: quizzes.length,
                    date: new Date().toISOString(),
                    questions: quizzes.map((quiz) => ({
                        questionId: quiz.id,
                        selectedAnswer: quiz.answers,
                    })),
                };

                try {
                    if (currentUser) {
                        await saveUserQuiz(currentUser.uid, result);
                    } else {
                        console.error("User is not authenticated.");
                    }
                    console.log("Quiz salvo com sucesso!");
                } catch (error) {
                    console.error("Erro ao salvar o quiz:", error);
                }
            }
        };

        saveQuizIfFinished();
    }, [isFinished]);

    const handleSelectOption = (optionIndex: number) => {
        if (!showFeedback) {
            setSelectedAnswers((prev) =>
                prev.includes(optionIndex)
                    ? prev.filter((idx) => idx !== optionIndex)
                    : [...prev, optionIndex]
            );
        }
    };

    const handleValidation = () => {
        setShowFeedback(true);
    };

    const handleNextQuestion = () => {
        const currentQuiz = quizzes[currentQuestion];
        const correctAnswers = currentQuiz.answers as number[];

        const sameSize = selectedAnswers.length === correctAnswers.length;
        const allIncluded = selectedAnswers.every((idx) => correctAnswers.includes(idx));
        const isSymmetric = correctAnswers.every((idx) => selectedAnswers.includes(idx));

        if (sameSize && allIncluded && isSymmetric) {
            setScore((prevScore) => prevScore + 1);
        }

        const nextQuestion = currentQuestion + 1;
        if (nextQuestion < quizzes.length) {
            setCurrentQuestion(nextQuestion);
            setSelectedAnswers([]);
            setShowFeedback(false);
        } else {
            setIsFinished(true);
        }
    };

    if (!quizzes.length && !isFinished) {
        return (
            <Center w="100%" h="100vh">
                <Text fontSize="lg">Chargement&hellip;</Text>
            </Center>
        );
    }

    if (isFinished) {
        const performanceMessage =
            score / quizzes.length >= 0.7
                ? "Félicitations ! Tu as bien réussi ce quiz, continue comme ça 😉"
                : "Ne te décourage pas ! C'est en faisant des erreurs qu'on apprend. N'hésite pas à relire la fiche correspondante si tu en ressens le besoin 💪";

        return (
            <Center w="100%" h="100vh" p={4}>
                <Card.Root maxW="md" w="full" p={4} boxShadow="lg">
                    <Card.Header>
                        <Heading as="h2" textAlign="center" size="md">
                            Quiz terminé !
                        </Heading>
                    </Card.Header>
                    <Card.Body>
                        <Text textAlign="center" fontSize="lg" mb={4}>
                            Votre score: <strong>{score}</strong> / {quizzes.length}
                        </Text>
                        <Text textAlign="center">
                            {performanceMessage}
                        </Text>
                        <Button
                            width="full"
                            mt={6}
                            colorPalette="blue"
                            onClick={() => navigate("/quiz")}
                        >
                            Retour aux quiz
                        </Button>
                    </Card.Body>
                </Card.Root>
            </Center>
        );
    }

    const currentQuiz = quizzes[currentQuestion];
    const progress = (currentQuestion / quizzes.length) * 100;
    return (
        <Box
            minH="100vh"
            display="flex"
            alignItems="center"
            justifyContent="center"
            p={4}
        >
            <Card.Root maxW="2xl" w="full" boxShadow="lg" position="relative">
                <Card.Header>
                    <Heading as="h3" size="md" textAlign="center">
                        {currentQuiz.question}
                    </Heading>
                    <Badge colorPalette="blue" position="absolute" top={2} right={4} fontSize="0.7em">
                        {currentQuiz.evaluation == 1 ? `niveau: ${currentQuiz.level}` : "Mode aléatoire"}
                    </Badge>

                </Card.Header>

                <Card.Body>
                    <Stack gap={4}>
                        {currentQuiz.options.map((option, index) => {
                            const isCorrect = currentQuiz.answers.includes(index);
                            const isSelected = selectedAnswers.includes(index);

                            let colorPalette = "gray";
                            if (showFeedback) {
                                if (isCorrect) colorPalette = "green";
                                else if (isSelected && !isCorrect) colorPalette = "red";
                            } else if (isSelected) {
                                colorPalette = "blue";
                            }

                            return (
                                <Button
                                    key={index}
                                    colorPalette={colorPalette}
                                    onClick={() => handleSelectOption(index)}
                                    textAlign="left"
                                    whiteSpace="normal"
                                    wordBreak="break-word"
                                    disabled={showFeedback} // Desabilitar durante feedback
                                    width="100%"
                                    minH={20}
                                >
                                    {option}
                                </Button>
                            );
                        })}
                    </Stack>

                    <Box mt={4}>
                        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                            <Text fontSize="sm">{`${progress.toFixed(0)}%`}</Text>
                            <Text fontSize="sm">100%</Text>
                        </Box>
                        <ProgressRoot value={progress}>
                            <ProgressBar colorPalette="blue" borderRadius="md" />
                        </ProgressRoot>
                    </Box>

                    <Button
                        mt={4}
                        w="full"
                        colorPalette="blue"
                        disabled={selectedAnswers.length === 0}
                        onClick={showFeedback ? handleNextQuestion : handleValidation}
                    >
                        {showFeedback ? "Question Suivant" : "Validation"}
                    </Button>
                </Card.Body>
            </Card.Root>
        </Box>
    );
}
