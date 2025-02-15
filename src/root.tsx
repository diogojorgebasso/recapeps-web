import {
    Links,
    Meta,
    Outlet,
    Scripts,
    ScrollRestoration,
} from "react-router";

import { AuthProvider } from "@/context/AuthContext";
import { CookieProvider } from "./context/CookieContext";
import { Provider } from "@/components/ui/provider"

export function Layout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="fr">
            <head>
                <meta charSet="UTF-8" />
                <link rel="canonical" href="https://recapeps.fr" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <link rel="icon" type="image/svg+xml" href="/logo.svg" sizes="any" />
                <link rel="mask-icon" href="/logo.svg" color="#FF7F2A" />
                <meta name="description" content="Recap’eps est un outil de révision imparable pour réussir les concours du CAPEPS externe. Que ce soit grâce à nos fiches de révisions thématiques, quiz ou flashcards, réviser n’a jamais été aussi facile." />
                <title>Recap'eps</title>
                <Meta />
                <Links />
            </head>
            <body>
                {children}
                <ScrollRestoration />
                <Scripts />
            </body>
        </html>
    );
}

export default function Root() {
    return (
        <Provider>
            <AuthProvider>
                <CookieProvider>
                    <Outlet />
                </CookieProvider>
            </AuthProvider>
        </Provider>
    );
}
