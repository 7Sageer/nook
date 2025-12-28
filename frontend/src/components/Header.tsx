import { CheckCircle } from 'lucide-react';

interface HeaderProps {
    title: string;
    status?: string;
    showTitle?: boolean;
}

export function Header({
    title,
    status,
    showTitle = true,
}: HeaderProps) {
    return (
        <header className={`app-header ${showTitle ? '' : 'header-transparent'}`}>
            <div className="header-left">
            </div>
            <div className="header-center">
                <h1 className={`header-title ${showTitle ? '' : 'header-title-hidden'}`}>
                    {title}
                </h1>
            </div>
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
