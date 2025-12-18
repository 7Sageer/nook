import { CheckCircle } from 'lucide-react';

interface HeaderProps {
    title: string;
    status?: string;
}

export function Header({ title, status }: HeaderProps) {
    return (
        <header className="app-header">
            <h1>{title}</h1>
            {status && (
                <span className="status">
                    <CheckCircle size={12} className="status-icon" />
                    {status}
                </span>
            )}
        </header>
    );
}
