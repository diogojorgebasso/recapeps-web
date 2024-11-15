import { logEvent, getAnalytics } from "firebase/analytics"
export default function Dashboard() {
    const analytics = getAnalytics();
    logEvent(analytics, 'tutorial_started');

    return (
        <div>
            <h1>Dashboard</h1>
        </div>
    )
}