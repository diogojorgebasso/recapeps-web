import { logEvent, getAnalytics } from "firebase/analytics"

import QuizScoresChart from "@/components/dashboard/UserQuizScoresChart";

export default function Dashboard() {
    const analytics = getAnalytics();
    logEvent(analytics, 'tutorial_started');

    return (
        <div>
            <QuizScoresChart />
        </div>
    )
}