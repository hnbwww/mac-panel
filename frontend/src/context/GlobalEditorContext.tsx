import React, { createContext, useContext, useState, ReactNode } from 'react';

interface GlobalEditorContextType {
  isOpen: boolean;
  isMinimized: boolean;
  pendingFile: { path: string; name: string } | null;
  openFile: (path: string, name: string) => void;
  minimize: () => void;
  restore: () => void;
}

const GlobalEditorContext = createContext<GlobalEditorContextType | undefined>(undefined);

export const useGlobalEditor = () => {
  const context = useContext(GlobalEditorContext);
  if (!context) {
    throw new Error('useGlobalEditor must be used within GlobalEditorProvider');
  }
  return context;
};

interface GlobalEditorProviderProps {
  children: ReactNode;
}

export const GlobalEditorProvider: React.FC<GlobalEditorProviderProps> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ path: string; name: string } | null>(null);

  const openFile = (path: string, name: string) => {
    setPendingFile({ path, name });
    setIsOpen(true);
    setIsMinimized(false);
  };

  const minimize = () => {
    setIsMinimized(true);
  };

  const restore = () => {
    setIsMinimized(false);
  };

  return (
    <GlobalEditorContext.Provider
      value={{
        isOpen,
        isMinimized,
        openFile,
        minimize,
        restore,
        pendingFile
      }}
    >
      {children}
    </GlobalEditorContext.Provider>
  );
};
