import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ArrowUp, Info, Map, User, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '../lib/utils';

/**
 * Кнопка для открытия бокового меню.
 */
export const SidebarMenuButton: React.FC<{
  onClick?: () => void;
  className?: string;
  ariaLabel?: string;
  active?: boolean;
}> = ({
  onClick,
  className,
  ariaLabel = 'Открыть меню',
  active
}) => (
  <button
    aria-label={ariaLabel}
    onClick={onClick}
    className={cn(
      'group relative inline-flex h-9 w-9 items-center justify-center ' +
      'rounded-md border border-border bg-white text-foreground shadow-sm ' +
      'transition-all hover:shadow-md focus-visible:outline-none ' +
      'focus-visible:ring-2 focus-visible:ring-ring/60',
      className
    )}
  >
    <svg viewBox="0 0 100 100" className="h-6 w-6 text-foreground/70" aria-hidden="true">
      <rect x="8" y="8" width="84" height="84" rx="18" ry="18" fill="none" stroke="currentColor" strokeWidth="6" />
      {/* Совмещённая полоса — строго по центру */}
      <motion.line
        x1="40"
        y1="16"
        x2="40"
        y2="84"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        initial={false}
        animate={{ x1: 40, x2: 40 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      />
    </svg>
  </button>
);

/**
 * Боковая панель, выезжающая слева.
 */
export const SidePanel: React.FC<{
  open: boolean;
  onClose: () => void;
  items?: { id: string; label: string; icon: React.ReactNode; href?: string; onClick?: () => void }[];
}> = ({
  open,
  onClose,
  items
}) => {
  const menuItems = items ?? [
    { id: 'about', label: 'About', icon: <Info className="h-5 w-5" /> },
    { id: 'roadmap', label: 'Roadmap', icon: <Map className="h-5 w-5" /> },
    { id: 'profile', label: 'Profile', icon: <User className="h-5 w-5" /> }
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          key="panel"
          className={
            'pointer-events-auto fixed left-0 top-0 z-30 h-full w-[84vw] max-w-sm ' +
            'bg-white/95 backdrop-blur-md shadow-xl ring-1 ring-border'
          }
          initial={{ x: '-100%' }}
          animate={{ x: 0 }}
          exit={{ x: '-100%' }}
          transition={{ type: 'spring', mass: 0.8, damping: 22 }}
          role="complementary"
          aria-label="Боковое меню"
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-[0.71rem]">
            <span className="text-lg font-semibold">Menu</span>
            <button
              onClick={onClose}
              aria-label="Закрыть"
              className={
                'inline-flex h-8 w-8 items-center justify-center rounded-md ' +
                'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 ' +
                'focus-visible:ring-ring/60'
              }
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex flex-col gap-2 px-5 py-4">
            {menuItems.map(item => (
              <a
                key={item.id}
                href={item.href ?? '#'}
                onClick={e => {
                  if (!item.href) e.preventDefault();
                  item.onClick?.();
                }}
                className={
                  'group flex items-center gap-3 rounded-lg px-3 py-2 text-lg ' +
                  'font-medium text-foreground/90 hover:bg-accent focus-visible:outline-none ' +
                  'focus-visible:ring-2 focus-visible:ring-ring/60'
                }
              >
                <span className="text-foreground/70 group-hover:text-foreground">{item.icon}</span>
                {item.label}
              </a>
            ))}
          </nav>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};

/**
 * Компонент строки поиска с круглой кнопкой и возможностью загрузки файла.
 */
export const SearchBar: React.FC<{
  placeholder?: string;
  onSubmit?: (value: string, file?: File | null) => void;
}> = ({
  placeholder = 'Upload image and ask',
  onSubmit
}) => {
  const [value, setValue] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const submit = () => {
    onSubmit?.(value.trim(), file);
    setValue('');
    setFile(null);
  };

  const removeFile = () => {
    setFile(null);
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="relative overflow-hidden rounded-full border border-border bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <div className="flex items-center gap-2 px-4">
          <label
            className={
              'relative inline-flex h-10 w-10 shrink-0 cursor-pointer items-center ' +
              'justify-center rounded-full text-foreground/60 hover:bg-accent ' +
              'hover:text-foreground'
            }
          >
            <input
              type="file"
              accept="image/*"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              aria-label="Загрузить изображение"
            />
            <Plus className="h-5 w-5" />
          </label>
          <input
            aria-label="Поле ввода запроса"
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={placeholder}
            className="peer h-12 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground/70"
          />
          <button
            type="button"
            onClick={submit}
            aria-label="Отправить"
            className={
              'inline-flex h-9 w-10 items-center justify-center rounded-full ' +
              'bg-white text-background shadow-sm transition hover:opacity-90 ' +
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60'
            }
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        </div>
      </div>
      {previewUrl && file && (
        <div className="mt-4 relative w-fit mx-right">
          <img
            src={previewUrl}
            alt={file.name}
            className="h-40 w-auto rounded-lg object-cover shadow-md"
          />
          <button
            onClick={removeFile}
            className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-gray-800 text-white transition-colors hover:bg-black focus:outline-none focus:ring-2 focus:ring-ring/60"
            aria-label="Убрать файл"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Компонент для вывода ответа.
 */
export const ResponseOutput: React.FC<{ response: string }> = ({ response }) => {
  if (!response) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.4 }}
      className="mt-8 w-full max-w-3xl text-base text-foreground/80"
    >
      <ReactMarkdown>{response}</ReactMarkdown>
    </motion.div>
  );
};


export const ChatMainPage: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const title = 'Start exploring';

  interface Message {
    id: string;
    sender: 'user' | 'assistant';
    text: string;
    imageUrl?: string;
  }

  const [messages, setMessages] = useState<Message[]>([]);

  const menuItems = [
    { id: 'about', label: 'About', icon: <Info className="h-5 w-5" />, href: '/about' },
    { id: 'roadmap', label: 'Roadmap', icon: <Map className="h-5 w-5" />, href: '/roadmap' },
    { id: 'profile', label: 'Profile', icon: <User className="h-5 w-5" />, href: '/profile' }
  ];

  const handleSearchSubmit = async (value: string, file?: File | null) => {
    if (!value.trim() && !file) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: value,
      imageUrl: file ? URL.createObjectURL(file) : undefined,
    };

    setMessages(prev => [...prev, userMessage]);
    setLoading(true);

    const formData = new FormData();
    formData.append('message', value);
    if (file) {
      formData.append('image', file);
    }

    try {
      const res = await fetch('/api/newland-chat', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Something went wrong');
      }

      const data = await res.json();
      const message = data.choices?.[0]?.message?.content;

      if (message) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          text: message,
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error('No response from AI');
      }
    } catch (error) {
      const err = error as Error;
      console.error('Fetch error:', err);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: `Error: ${err.message}`,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex h-screen w-full flex-col bg-background">
      <header
        className={
          'sticky top-0 z-30 flex h-14 w-full items-center justify-between ' +
          'border-b border-border bg-white/80 px-3 backdrop-blur-md'
        }
      >
        <div className="flex items-center gap-2">
          <SidebarMenuButton active={open} onClick={() => setOpen(true)} />
          <a href="/landing" className="ml-1 text-[1.5rem] font-medium text-foreground/70 no-underline">
            What bird
          </a>
        </div>
      </header>
      <main className="flex-1 flex flex-col">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <motion.h1
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mb-10 text-center text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
            >
              {title}
            </motion.h1>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.4 }}
              className="w-full"
            >
              <SearchBar onSubmit={handleSearchSubmit} />
            </motion.div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="max-w-3xl mx-auto">
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex mb-4',
                      msg.sender === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'p-3 rounded-lg max-w-md',
                        msg.sender === 'user'
                          ? ''
                          : 'bg-white text-black shadow-md'
                      )}
                    >
                      {msg.imageUrl && (
                        <img
                          src={msg.imageUrl}
                          alt="user upload"
                          className="h-40 w-auto rounded-lg object-cover mb-2"
                        />
                      )}
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start mb-4">
                    <div className="p-3 rounded-lg shadow-md bg-white text-black">
                      Loading...
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="p-4">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05, duration: 0.4 }}
                className="w-full"
              >
                <SearchBar onSubmit={handleSearchSubmit} />
              </motion.div>
            </div>
          </>
        )}
      </main>
      <SidePanel open={open} onClose={() => setOpen(false)} items={menuItems} />
    </div>
  );
};


const container = document.getElementById('root');
if (container) {
  const root = ReactDOM.createRoot(container);
  root.render(<ChatMainPage />);
}

