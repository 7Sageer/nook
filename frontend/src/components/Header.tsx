import { useTheme } from '../contexts/ThemeContext';
import { Cloud, CloudOff, Loader2 } from 'lucide-react';
import { STRINGS } from '../constants/strings';

interface HeaderProps {
    title: string;
    status: string;
}

export function Header({ title, status }: HeaderProps) {
    const { theme } = useTheme();

    const getStatusIcon = () => {
        if (status.includes('保存中') || status.includes('加载')) {
            return <Loader2 size={12} className="status-icon spinning" />;
        }
        if (status.includes('已保存') || status.includes('成功')) {
            return <Cloud size={12} className="status-icon" />;
        }
        return <CloudOff size={12} className="status-icon" />;
    };

    return (
        <header className={`app-header ${theme}`}>
            <h1>{title || STRINGS.APP_NAME}</h1>
            <span className="status">
                {getStatusIcon()}
                {status}
            </span>
        </header>
    );
}
