import { db } from "@/utils/firebase";
import { collection, getDocs } from 'firebase/firestore';
import { Quiz, Subject } from "@/types/Quizz";

// Função para buscar todas as matérias
export const fetchSubjects = async (): Promise<Subject[]> => {
  const querySnapshot = await getDocs(collection(db, 'subjects'));
  return querySnapshot.docs.map(doc => ({
    ...(doc.data() as Subject),
    id: doc.id,
  }));
};

// Função para buscar quizzes de uma matéria específica
export const fetchQuizzesBySubject = async (subjectId: string): Promise<Quiz[]> => {
  const quizzesRef = collection(db, `subjects/${subjectId}/quizzes`);
  const querySnapshot = await getDocs(quizzesRef);
  return querySnapshot.docs.map(doc => ({
    ...(doc.data() as Quiz),
    id: doc.id,
  }));
};
