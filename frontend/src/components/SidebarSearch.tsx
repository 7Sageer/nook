import { Search } from 'lucide-react';
import { STRINGS } from '../constants/strings';

interface SidebarSearchProps {
    query: string;
    onQueryChange: (query: string) => void;
}

export function SidebarSearch({ query, onQueryChange }: SidebarSearchProps) {
    return (
        <div className="search-wrapper">
            <Search size={16} className="search-icon" />
            <input
                type="text"
                className="search-input"
                placeholder={STRINGS.LABELS.SEARCH_PLACEHOLDER}
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
            />
        </div>
    );
}
