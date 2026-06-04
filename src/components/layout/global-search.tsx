'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Users, UserCircle, Handshake } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { globalSearch } from '@/lib/actions/dashboard';
import type { SearchResult } from '@/lib/types';

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    try {
      const data = await globalSearch(q);
      setResults(data);
    } catch {
      setResults([]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  const iconMap = {
    client: Users,
    family: UserCircle,
    lead: Handshake,
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search clients, families, PAN..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          className="pl-10 bg-gray-50 border-gray-200"
        />
      </div>

      {isOpen && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-sm text-gray-500 text-center">Searching...</div>
          ) : results.length === 0 ? (
            <div className="p-4 text-sm text-gray-500 text-center">No results found</div>
          ) : (
            results.map((result) => {
              const Icon = iconMap[result.type];
              return (
                <button
                  key={`${result.type}-${result.id}`}
                  className="flex w-full items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left border-b last:border-0"
                  onClick={() => {
                    router.push(result.link);
                    setQuery('');
                    setIsOpen(false);
                  }}
                >
                  <Icon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{result.name}</p>
                    <p className="text-xs text-gray-500 truncate">{result.subtitle}</p>
                  </div>
                  <span className="text-xs text-gray-400 capitalize">{result.type}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
