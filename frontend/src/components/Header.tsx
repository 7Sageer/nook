import { CheckCircle } from 'lucide-react';

interface HeaderProps {
    title: string;
    status?: string;
}

export function Header({ title, status }: HeaderProps) {
    return (
        <header className="app-header">
            <div className="header-left">
            </div>
            <h1 className="header-title">{title}</h1>
            <div className="header-right">
                {status && (
                    <span className="status">
                        <CheckCircle size={12} className="status-icon" />
                        {status}
                    </span>
                )}
            </div>
        </header>
    );
}
