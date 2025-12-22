import { Search } from 'lucide-react';
import { STRINGS } from '../constants/strings';

interface SidebarSearchProps {
    query: string;
    onQueryChange: (query: string) => void;
}

export function SidebarSearch({ query, onQueryChange }: SidebarSearchProps) {
    return (
        <div className="search-wrapper" role="search">
            <Search size={16} className="search-icon" aria-hidden="true" />
            <input
                type="text"
                className="search-input"
                placeholder={STRINGS.LABELS.SEARCH_PLACEHOLDER}
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                aria-label={STRINGS.LABELS.SEARCH_PLACEHOLDER}
            />
        </div>
    );
}
