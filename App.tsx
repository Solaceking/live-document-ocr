import React, { useState, useCallback, ChangeEvent, useEffect, useRef } from 'react';
import { extractTextFromImageStream, processTextWithAI } from './services/geminiService';

// --- Helper Functions and Components ---

// A basic sanitizer to prevent XSS. For production, a library like DOMPurify is strongly recommended.
const sanitizeHtml = (html: string): string => {
  if (typeof html !== 'string') return '';
  // Remove script tags entirely
  let sanitized = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  // Remove on* event handlers from any tag
  sanitized = sanitized.replace(/ on\w+=(["']?)(?:(?!\1).)*\1/gi, '');
  return sanitized;
};


// SVG Icons
const UploadIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const CameraIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.776 48.776 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
    </svg>
);

const DownloadIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
);

const SaveIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
        <polyline points="17 21 17 13 7 13 7 21"></polyline>
        <polyline points="7 3 7 8 15 8"></polyline>
    </svg>
);

const MagicWandIcon: React.FC<{ className?: string; isAnimating?: boolean }> = ({ className, isAnimating }) => (
  <svg className={`${className} ${isAnimating ? 'animate-pulse' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12a10 10 0 1 0-20 0" />
    <path d="M22 12a10 10 0 0 0-20 0" />
    <path d="M12 2v20" />
    <path d="M12 2a10 10 0 0 0 0 20" />
    <path d="M2 12h20" />
    <path d="M2 12a10 10 0 0 0 20 0" />
    <path d="m15 5 3-3" />
    <path d="m6 18 3-3" />
    <path d="m6 6 3 3" />
    <path d="m15 19 3 3" />
  </svg>
);

const SparklesIcon: React.FC<{ className?: string; isAnimating?: boolean }> = ({ className, isAnimating }) => (
  <svg className={`${className} ${isAnimating ? 'animate-pulse' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v.01" />
    <path d="M16.2 7.8l.01.01" />
    <path d="M21 12h-.01" />
    <path d="M16.2 16.2l.01.01" />
    <path d="M12 21v-.01" />
    <path d="M7.8 16.2l-.01.01" />
    <path d="M3 12h.01" />
    <path d="M7.8 7.8l-.01.01" />
  </svg>
);


// Rich Text Icons
const BoldIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
        <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
    </svg>
);

const ItalicIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="19" y1="4" x2="10" y2="4"></line>
        <line x1="14" y1="20" x2="5" y2="20"></line>
        <line x1="15" y1="4" x2="9" y2="20"></line>
    </svg>
);

const UnderlineIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"></path>
        <line x1="4" y1="21" x2="20" y2="21"></line>
    </svg>
);

const StrikethroughIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 4H8a4 4 0 0 0-4 4v0a4 4 0 0 0 4 4h1a3 3 0 0 1 3 3v0a3 3 0 0 1-3 3H7"></path>
        <line x1="4" y1="12" x2="20" y2="12"></line>
    </svg>
);

const CodeIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6"></polyline>
        <polyline points="8 6 2 12 8 18"></polyline>
    </svg>
);

const BlockquoteIcon: React.FC<{ className?: string }> = ({ className }) => (
     <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="5" x2="4" y2="19"></line>
        <line x1="9" y1="7" x2="19" y2="7"></line>
        <line x1="9" y1="12" x2="19" y2="12"></line>
        <line x1="9" y1="17" x2="19" y2="17"></line>
    </svg>
);

// Skeleton Loader Component
const SkeletonLoader: React.FC = () => (
    <div className="flex flex-col items-center justify-center w-full h-full animate-pulse p-5">
        <div className="w-12 h-12 mb-4 bg-gray-600 rounded-lg"></div>
        <div className="h-4 w-3/4 mb-2 bg-gray-600 rounded"></div>
        <div className="h-3 w-1/2 bg-gray-600 rounded"></div>
    </div>
);

// Camera Modal Component
interface CameraModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCapture: (file: File) => void;
}
const CameraModal: React.FC<CameraModalProps> = ({ isOpen, onClose, onCapture }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);

    useEffect(() => {
        const startCamera = async () => {
            if (isOpen) {
                setCameraError(null);
                setCapturedImage(null);
                try {
                    const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                    setStream(mediaStream);
                    if (videoRef.current) {
                        videoRef.current.srcObject = mediaStream;
                    }
                } catch (err) {
                    console.error("Camera access error:", err);
                    setCameraError("Could not access camera. Please check browser permissions for this site.");
                }
            }
        };
        startCamera();

        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
                setStream(null);
            }
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleCapture = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video && canvas) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            context?.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
            setCapturedImage(canvas.toDataURL('image/jpeg'));
        }
    };

    const handleUsePhoto = () => {
        canvasRef.current?.toBlob(blob => {
            if (blob) {
                const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
                onCapture(file);
            }
        }, 'image/jpeg');
    };
    
    const handleRetake = () => setCapturedImage(null);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl p-4 w-full max-w-2xl text-center relative">
                <button onClick={onClose} className="absolute top-2 right-2 text-white bg-gray-700 rounded-full w-8 h-8 flex items-center justify-center">&times;</button>
                <h3 className="text-xl font-bold mb-4">Camera Capture</h3>
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                    {cameraError ? (
                        <div className="flex items-center justify-center h-full text-red-400">{cameraError}</div>
                    ) : capturedImage ? (
                        <img src={capturedImage} alt="Captured preview" className="w-full h-full object-contain" />
                    ) : (
                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain"></video>
                    )}
                    <canvas ref={canvasRef} className="hidden"></canvas>
                </div>
                <div className="mt-4 flex justify-center space-x-4">
                    {capturedImage ? (
                        <>
                            <button onClick={handleRetake} className="px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Retake</button>
                            <button onClick={handleUsePhoto} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">Use Photo</button>
                        </>
                    ) : (
                        <button onClick={handleCapture} disabled={!!cameraError} className="px-6 py-3 text-white bg-indigo-600 rounded-full hover:bg-indigo-700 disabled:bg-gray-500 transition-colors">Capture</button>
                    )}
                </div>
            </div>
        </div>
    );
};


// ImageUploader Component
interface ImageUploaderProps {
  onImageSelected: (file: File) => void;
  imageUrl: string | null;
  isLoading: boolean;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageSelected, imageUrl, isLoading }) => {
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
        onImageSelected(event.target.files[0]);
    }
  };

  const handleCameraCapture = (file: File) => {
    onImageSelected(file);
    setIsCameraOpen(false);
  };
  
  return (
    <div className="bg-gray-800 p-6 rounded-xl shadow-lg relative h-full flex flex-col justify-center">
      <div className="relative flex flex-col w-full h-full border-2 border-dashed border-gray-600 rounded-lg bg-gray-700">
        {isLoading ? (
            <div className="flex items-center justify-center h-full"><SkeletonLoader /></div>
        ) : imageUrl ? (
          <img src={imageUrl} alt="Preview" className="w-full h-full object-contain rounded-lg p-2" />
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-5 flex-grow">
            <UploadIcon className="w-12 h-12 mb-4 text-gray-400" />
            <label htmlFor="file-upload" className="cursor-pointer">
              <p className="mb-2 text-sm text-gray-400"><span className="font-semibold text-indigo-400">Click to upload</span> or drag and drop</p>
              <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
            </label>
            <div className="my-4 text-xs text-gray-500">OR</div>
            <button onClick={() => setIsCameraOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-gray-800 transition-colors">
                <CameraIcon className="w-5 h-5"/>
                Use Camera
            </button>
          </div>
        )}
        <input id="file-upload" type="file" className="hidden" onChange={handleFileChange} accept="image/*" disabled={isLoading} />
      </div>
      <CameraModal isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onCapture={handleCameraCapture} />
    </div>
  );
};


// --- Rich Text Editing Components ---
interface RichTextToolbarProps {
  onFormat: (command: string, value?: string) => void;
  activeFormats: Record<string, boolean>;
  onSummarize: () => void;
  isSummarizing: boolean;
}
const RichTextToolbar: React.FC<RichTextToolbarProps> = ({ onFormat, activeFormats, onSummarize, isSummarizing }) => {
    const styleButtons = [
        { command: 'bold', icon: <BoldIcon className="w-5 h-5" />, label: 'Bold' },
        { command: 'italic', icon: <ItalicIcon className="w-5 h-5" />, label: 'Italic' },
        { command: 'underline', icon: <UnderlineIcon className="w-5 h-5" />, label: 'Underline' },
        { command: 'strikeThrough', icon: <StrikethroughIcon className="w-5 h-5" />, label: 'Strikethrough' },
    ];

    const blockButtons = [
        { command: 'formatBlock', value: 'blockquote', icon: <BlockquoteIcon className="w-5 h-5" />, label: 'Blockquote' },
        { command: 'formatBlock', value: 'pre', icon: <CodeIcon className="w-5 h-5" />, label: 'Code Block' },
    ];

    return (
        <div className="bg-gray-700 p-2 flex items-center space-x-1 border-b border-gray-600 flex-wrap">
            {styleButtons.map(({ command, icon, label }) => (
                <button
                    key={command}
                    onMouseDown={(e) => {
                        e.preventDefault(); // Prevent editor from losing focus
                        onFormat(command);
                    }}
                    className={`p-2 rounded-md transition-colors ${activeFormats[command] ? 'bg-indigo-600 text-white' : 'hover:bg-gray-600 text-gray-300 hover:text-white'}`}
                    aria-pressed={activeFormats[command]}
                    aria-label={label}
                    title={label}
                >
                    {icon}
                </button>
            ))}
            <div className="w-px h-5 bg-gray-600 mx-1"></div> {/* Separator */}
            {blockButtons.map(({ command, value, icon, label }) => (
                <button
                    key={value}
                    onMouseDown={(e) => {
                        e.preventDefault(); // Prevent editor from losing focus
                        onFormat(command, value);
                    }}
                    className={`p-2 rounded-md transition-colors ${activeFormats[value] ? 'bg-indigo-600 text-white' : 'hover:bg-gray-600 text-gray-300 hover:text-white'}`}
                    aria-pressed={activeFormats[value]}
                    aria-label={label}
                    title={label}
                >
                    {icon}
                </button>
            ))}
             <div className="w-px h-5 bg-gray-600 mx-1"></div> {/* Separator */}
             <button
                onMouseDown={(e) => {
                    e.preventDefault();
                    onSummarize();
                }}
                disabled={isSummarizing}
                className="p-2 rounded-md transition-colors hover:bg-gray-600 text-gray-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Summarize Document"
                title="Summarize Document"
            >
                <SparklesIcon className="w-5 h-5" isAnimating={isSummarizing} />
            </button>
        </div>
    );
};


// LivingDocument Component
interface LivingDocumentProps {
    title: string;
    onTitleChange: (newTitle: string) => void;
    onSuggestTitle: () => void;
    isSuggestingTitle: boolean;
    content: string;
    onClear: () => void;
    onContentChange: (newContent: string) => void;
    onDownload: () => void;
    onSave: () => void;
    hasUnsavedChanges: boolean;
    onSummarize: () => void;
    isSummarizing: boolean;
}
const LivingDocument: React.FC<LivingDocumentProps> = (props) => {
    const { 
        title, onTitleChange, onSuggestTitle, isSuggestingTitle,
        content, onClear, onContentChange, onDownload, onSave, hasUnsavedChanges,
        onSummarize, isSummarizing
    } = props;
    const editorRef = useRef<HTMLDivElement>(null);
    const [activeFormats, setActiveFormats] = useState<Record<string, boolean>>({});

    // Sync state to the editable div, but only when it differs.
    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== content) {
            editorRef.current.innerHTML = content;
        }
    }, [content]);
    
    const updateActiveFormats = useCallback(() => {
        const newFormats: Record<string, boolean> = {};
        const commands = ['bold', 'italic', 'underline', 'strikeThrough'];
        commands.forEach(cmd => {
            newFormats[cmd] = document.queryCommandState(cmd);
        });
        setActiveFormats(newFormats);
    }, []);

    useEffect(() => {
        const handleSelectionChange = () => {
           if (document.activeElement === editorRef.current) {
               updateActiveFormats();
           }
        };
        document.addEventListener('selectionchange', handleSelectionChange);
        return () => document.removeEventListener('selectionchange', handleSelectionChange);
    }, [updateActiveFormats]);


    const handleInput = (event: React.FormEvent<HTMLDivElement>) => {
        onContentChange(event.currentTarget.innerHTML);
    };

    const handleFormat = (command: string, value?: string) => {
        editorRef.current?.focus();
        document.execCommand(command, false, value);
        if (editorRef.current) {
            onContentChange(editorRef.current.innerHTML);
            updateActiveFormats(); // Update immediately after formatting
        }
    };

    return (
        <div className="bg-gray-800 p-6 rounded-xl shadow-lg h-full flex flex-col">
            <div className="flex justify-between items-center mb-4 gap-4 flex-wrap">
                 <div className="flex items-center gap-2 flex-grow min-w-[200px]">
                    <input 
                        type="text" 
                        value={title} 
                        onChange={(e) => onTitleChange(e.target.value)}
                        placeholder="Untitled Document"
                        className="text-2xl font-bold text-gray-100 bg-transparent focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded-md px-2 py-1 w-full"
                    />
                     <button onClick={onSuggestTitle} disabled={isSuggestingTitle} title="Suggest Title with AI" className="p-2 rounded-full hover:bg-gray-700 text-indigo-400 disabled:opacity-50 disabled:cursor-wait">
                        <MagicWandIcon className="w-5 h-5" isAnimating={isSuggestingTitle}/>
                    </button>
                    {hasUnsavedChanges && <span className="text-xs font-medium text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full">Unsaved</span>}
                </div>
                <div className="flex items-center space-x-2">
                     <button
                        onClick={onSave}
                        disabled={!hasUnsavedChanges}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 focus:ring-offset-gray-900 disabled:bg-green-900 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
                    >
                        <SaveIcon className="w-4 h-4" />
                        Save
                    </button>
                    <button
                        onClick={onDownload}
                        disabled={!content && (!editorRef.current || editorRef.current.innerHTML === '')}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-gray-900 disabled:bg-indigo-900 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        Download
                    </button>
                    <button
                        onClick={onClear}
                        disabled={!content && (!editorRef.current || editorRef.current.innerHTML === '')}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 focus:ring-offset-gray-900 disabled:bg-red-900 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
                    >
                        Clear
                    </button>
                </div>
            </div>
            <div className="flex-grow flex flex-col rounded-lg overflow-hidden bg-gray-900">
                <RichTextToolbar onFormat={handleFormat} activeFormats={activeFormats} onSummarize={onSummarize} isSummarizing={isSummarizing} />
                <div className="prose prose-invert prose-p:text-gray-300 prose-headings:text-gray-100 prose-pre:bg-gray-800 prose-pre:text-gray-300 prose-blockquote:border-l-indigo-400 w-full flex-grow overflow-y-auto custom-scrollbar p-4">
                     <div
                        ref={editorRef}
                        contentEditable={true}
                        onInput={handleInput}
                        onMouseUp={updateActiveFormats}
                        onKeyUp={updateActiveFormats}
                        suppressContentEditableWarning={true}
                        data-placeholder="Extracted text will appear here. You can also edit this document directly."
                        className="whitespace-pre-wrap font-sans text-gray-300 w-full h-full min-h-[4rem] focus:outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-500 empty:before:italic"
                     />
                </div>
            </div>
        </div>
    );
};

// --- History Feature Components ---
interface HistoryItem {
  id: number;
  timestamp: string;
  text: string;
}

interface ExtractionHistoryProps {
  history: HistoryItem[];
  onClearHistory: () => void;
  expandedHistoryId: number | null;
  onToggleExpand: (id: number) => void;
  onCopy: (text: string) => void;
  onAppend: (text: string) => void;
}

const ExtractionHistory: React.FC<ExtractionHistoryProps> = ({ history, onClearHistory, expandedHistoryId, onToggleExpand, onCopy, onAppend }) => {
  return (
    <div className="bg-gray-800 p-6 rounded-xl shadow-lg mt-8 flex flex-col max-h-[40vh]">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-gray-100">Extraction History</h3>
        {history.length > 0 && (
            <button
              onClick={onClearHistory}
              className="px-3 py-1 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 focus:ring-offset-gray-900 transition-colors"
            >
              Clear History
            </button>
        )}
      </div>
      {history.length === 0 ? (
        <p className="text-gray-400 text-sm">No extractions yet. Upload an image to start.</p>
      ) : (
        <ul className="space-y-3 overflow-y-auto custom-scrollbar pr-2 flex-grow">
          {history.map(item => {
            const isExpanded = item.id === expandedHistoryId;
            return (
                <li key={item.id} className="bg-gray-700 p-3 rounded-lg transition-shadow hover:shadow-md">
                    <p className="text-xs text-indigo-300 mb-1">{item.timestamp}</p>
                    <div 
                       className={`prose prose-invert prose-sm max-w-none text-gray-200 ${!isExpanded ? 'line-clamp-3' : ''}`}
                       dangerouslySetInnerHTML={{ __html: item.text }}
                    />
                    <div className="flex items-center space-x-2 mt-2 pt-2 border-t border-gray-600/50">
                        <button onClick={() => onToggleExpand(item.id)} className="text-xs font-semibold text-indigo-300 hover:underline">
                            {isExpanded ? 'View Less' : 'View More'}
                        </button>
                        <div className="flex-grow"></div>
                         <button onClick={() => onCopy(item.text)} title="Copy to Clipboard" className="text-xs px-2 py-1 rounded-md bg-gray-600 hover:bg-gray-500 text-gray-300 hover:text-white transition-colors">Copy</button>
                         <button onClick={() => onAppend(item.text)} title="Append to Document" className="text-xs px-2 py-1 rounded-md bg-gray-600 hover:bg-gray-500 text-gray-300 hover:text-white transition-colors">Append</button>
                    </div>
                </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

// --- OCR Settings Component ---
interface OcrSettingsProps {
    context: string;
    onContextChange: (newContext: string) => void;
    quality: string;
    onQualityChange: (newQuality: string) => void;
    llm: string;
    onLlmChange: (newLlm: string) => void;
}

const OcrSettings: React.FC<OcrSettingsProps> = ({ context, onContextChange, quality, onQualityChange, llm, onLlmChange }) => {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
                <label htmlFor="ocr-context" className="block text-sm font-medium text-gray-300 mb-2">
                    Optimize OCR for:
                </label>
                <select
                    id="ocr-context"
                    value={context}
                    onChange={(e) => onContextChange(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5"
                >
                    <option value="general">General Document</option>
                    <option value="book">Book / Article</option>
                    <option value="receipt">Receipt</option>
                    <option value="handwriting">Handwritten Notes</option>
                    <option value="whiteboard">Whiteboard</option>
                    <option value="quiz">Multiple Choice Quiz</option>
                </select>
            </div>
            <div>
                 <label htmlFor="ocr-quality" className="block text-sm font-medium text-gray-300 mb-2">
                    Extraction Quality:
                </label>
                <select
                    id="ocr-quality"
                    value={quality}
                    onChange={(e) => onQualityChange(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5"
                >
                    <option value="standard">Standard</option>
                    <option value="enhanced">Enhanced (Slower)</option>
                </select>
            </div>
            <div>
                 <label htmlFor="llm-select" className="block text-sm font-medium text-gray-300 mb-2">
                    AI Model:
                </label>
                <select
                    id="llm-select"
                    value={llm}
                    onChange={(e) => onLlmChange(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5"
                >
                    <option value="gemini">Gemini</option>
                    <option value="deepseek">DeepSeek</option>
                    <option value="openai">OpenAI (GPT-4o)</option>
                </select>
            </div>
        </div>
    );
};

// --- Toast Notification Component ---
type ToastType = 'success' | 'error' | 'info';
interface ToastProps {
    message: string;
    type: ToastType;
    onClose: () => void;
}
const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
    const baseClasses = "fixed top-5 right-5 z-50 flex items-center w-full max-w-xs p-4 space-x-4 text-gray-500 bg-white divide-x divide-gray-200 rounded-lg shadow dark:text-gray-400 dark:divide-gray-700 space-x dark:bg-gray-800 transition-opacity duration-300";
    const typeClasses = {
        success: 'dark:bg-green-800/90 dark:text-green-200',
        error: 'dark:bg-red-800/90 dark:text-red-200',
        info: 'dark:bg-blue-800/90 dark:text-blue-200',
    };

    useEffect(() => {
        const timer = setTimeout(onClose, 5000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`${baseClasses} ${typeClasses[type]}`} role="alert">
            <div className="text-sm font-normal">{message}</div>
            <button onClick={onClose} className="p-1.5 -m-1.5 ml-auto inline-flex items-center justify-center text-gray-400 hover:text-gray-900 rounded-lg focus:ring-2 focus:ring-gray-300 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-white dark:bg-gray-800 dark:hover:bg-gray-700">
                <span className="sr-only">Close</span>
                <svg className="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/>
                </svg>
            </button>
        </div>
    );
};


// --- Main App Component ---
export default function App() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [documentTitle, setDocumentTitle] = useState<string>('Untitled Document');
  const [livingDocument, setLivingDocument] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSuggestingTitle, setIsSuggestingTitle] = useState<boolean>(false);
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);
  const [extractionHistory, setExtractionHistory] = useState<HistoryItem[]>([]);
  const [ocrContext, setOcrContext] = useState<string>('general');
  const [ocrQuality, setOcrQuality] = useState<string>('standard');
  const [selectedLlm, setSelectedLlm] = useState<string>('gemini'); // New state for LLM selection
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [toast, setToast] = useState<{ id: number; message: string; type: ToastType } | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<number | null>(null);

  const showToast = (message: string, type: ToastType) => {
    setToast({ id: Date.now(), message, type });
  };

  // Load content from localStorage on initial render
  useEffect(() => {
    try {
      const savedTitle = localStorage.getItem('documentTitle');
      if (savedTitle) {
        setDocumentTitle(savedTitle);
      }
      const savedContent = localStorage.getItem('livingDocumentContent');
      if (savedContent) {
        setLivingDocument(sanitizeHtml(savedContent));
      }
      const savedHistory = localStorage.getItem('extractionHistory');
      if (savedHistory) {
        setExtractionHistory(JSON.parse(savedHistory));
      }
    } catch (e) {
      console.error("Failed to load from localStorage:", e);
      showToast('Could not load saved data.', 'error');
    }
  }, []);

  // Prompt user before leaving if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        event.preventDefault();
        event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);


  // Save history to localStorage whenever it changes
  useEffect(() => {
    try {
        localStorage.setItem('extractionHistory', JSON.stringify(extractionHistory));
    } catch (e) {
        console.error("Failed to save history to localStorage:", e);
        showToast('Could not save extraction history.', 'error');
    }
  }, [extractionHistory]);

  const handleFileReady = useCallback(async (file: File) => {
    if (!file) return;
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (!file.type.startsWith('image/')) {
        showToast('Invalid file type. Please upload an image.', 'error');
        return;
    }
    if (file.size > MAX_FILE_SIZE) {
        showToast('File is too large. Please upload an image under 10MB.', 'error');
        return;
    }

    setIsLoading(true);
    const tempImageUrl = URL.createObjectURL(file);
    setImageUrl(tempImageUrl);

    let fullExtractedText = '';
    let isFirstChunk = true;

    try {
        const stream = extractTextFromImageStream(file, ocrContext, ocrQuality, selectedLlm);
        
        for await (const chunk of stream) {
            if (isFirstChunk) {
                setLivingDocument(prevDoc => prevDoc + (prevDoc ? '<br><br>---<br><br>' : ''));
                isFirstChunk = false;
            }
            fullExtractedText += chunk;
            setLivingDocument(prevDoc => prevDoc + chunk);
        }
        
        if (fullExtractedText) {
            const newHistoryItem: HistoryItem = {
                id: Date.now(),
                timestamp: new Date().toLocaleString(),
                text: fullExtractedText,
            };
            setExtractionHistory(prevHistory => [newHistoryItem, ...prevHistory]);
            setHasUnsavedChanges(true);
            showToast('Text extracted successfully!', 'success');
        } else {
            showToast('Extraction resulted in empty text.', 'info');
        }

    } catch (err) {
        showToast(err instanceof Error ? err.message : "An unknown error occurred.", 'error');
    } finally {
        setIsLoading(false);
        setImageUrl(null);
        URL.revokeObjectURL(tempImageUrl);
    }
  }, [ocrContext, ocrQuality, selectedLlm]);

  const handleClearDocument = useCallback(() => {
     if (hasUnsavedChanges && !window.confirm("You have unsaved changes that will be lost. Are you sure you want to clear the document?")) {
        return;
    }
    setLivingDocument('');
    setDocumentTitle('Untitled Document');
    setHasUnsavedChanges(false);
    try {
      localStorage.removeItem('livingDocumentContent');
      localStorage.removeItem('documentTitle');
      showToast('Document cleared.', 'info');
    } catch (e) {
      console.error("Failed to clear localStorage:", e);
      showToast('Failed to clear document from storage.', 'error');
    }
  }, [hasUnsavedChanges]);

  const handleClearHistory = useCallback(() => {
    setExtractionHistory([]);
    try {
        localStorage.removeItem('extractionHistory');
        showToast('Extraction history cleared.', 'info');
    } catch (e) {
        console.error("Failed to clear history from localStorage:", e);
        showToast('Failed to clear history from storage.', 'error');
    }
  }, []);
  
  const handleDocumentChange = (newContent: string) => {
    setLivingDocument(newContent);
    setHasUnsavedChanges(true);
  };

  const handleTitleChange = (newTitle: string) => {
    setDocumentTitle(newTitle);
    setHasUnsavedChanges(true);
  };

  const handleSaveDocument = useCallback(() => {
    try {
        const sanitizedContent = sanitizeHtml(livingDocument);
        localStorage.setItem('livingDocumentContent', sanitizedContent);
        localStorage.setItem('documentTitle', documentTitle);
        
        if (livingDocument !== sanitizedContent) {
            setLivingDocument(sanitizedContent);
        }
        setHasUnsavedChanges(false);
        showToast('Document saved to browser storage.', 'success');
    } catch (e) {
        console.error("Failed to save to localStorage:", e);
        showToast('Failed to save document.', 'error');
    }
  }, [livingDocument, documentTitle]);
  
  const handleSuggestTitle = useCallback(async () => {
    if (!livingDocument) {
      showToast('Cannot suggest a title for an empty document.', 'info');
      return;
    }
    setIsSuggestingTitle(true);
    try {
      // Use plain text for better title generation
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = livingDocument;
      const plainText = tempDiv.textContent || '';
      
      const suggestedTitle = await processTextWithAI(plainText.substring(0, 1000), 'title', selectedLlm);
      setDocumentTitle(suggestedTitle);
      setHasUnsavedChanges(true);
      showToast('Title suggested by AI!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to suggest a title.", 'error');
    } finally {
      setIsSuggestingTitle(false);
    }
  }, [livingDocument, selectedLlm]);

  const handleSummarize = useCallback(async () => {
    if (!livingDocument) {
      showToast('Cannot summarize an empty document.', 'info');
      return;
    }
    setIsSummarizing(true);
    try {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = livingDocument;
      const plainText = tempDiv.textContent || '';

      const summary = await processTextWithAI(plainText, 'summarize', selectedLlm);
      const summaryHtml = `<h2>Summary</h2><p>${summary}</p><br><hr><br>`;
      setLivingDocument(prevDoc => summaryHtml + prevDoc);
      setHasUnsavedChanges(true);
      showToast('Summary added to document!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to generate summary.", 'error');
    } finally {
      setIsSummarizing(false);
    }
  }, [livingDocument, selectedLlm]);

  const handleDownloadDocument = useCallback(() => {
    if (!livingDocument) return;
    const tempDiv = document.createElement('div');
    const contentWithNewlines = livingDocument.replace(/<br\s*\/?>/gi, '\n');
    tempDiv.innerHTML = contentWithNewlines;
    const textContent = tempDiv.textContent || tempDiv.innerText || '';

    const blob = new Blob([textContent.trim()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'document.txt');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [livingDocument]);

  const handleCopyToClipboard = useCallback((text: string) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = text;
    const plainText = tempDiv.textContent || tempDiv.innerText || '';
    
    navigator.clipboard.writeText(plainText).then(() => {
        showToast('Copied to clipboard!', 'success');
    }, () => {
        showToast('Failed to copy text.', 'error');
    });
  }, []);

  const handleAppendToDocument = useCallback((text: string) => {
    setLivingDocument(prevDoc => {
        const newDoc = prevDoc + (prevDoc ? '<br><br>---<br><br>' : '') + text;
        setHasUnsavedChanges(true);
        return newDoc;
    });
    showToast('Appended to document.', 'info');
  }, []);

  const handleToggleExpandHistory = useCallback((id: number) => {
    setExpandedHistoryId(prevId => (prevId === id ? null : id));
  }, []);


  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 lg:p-8">
      <style>{`
        .prose table { width: 100%; }
        .prose th, .prose td { border: 1px solid #4b5563; padding: 0.5rem 1rem; }
        .prose th { background-color: #374151; }
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #1f2937; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #4f46e5; border-radius: 20px; border: 3px solid #1f2937; }
        .line-clamp-3 {
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }
      `}</style>

      {toast && <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="container mx-auto max-w-7xl">
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">
            AI Document Processor
          </h1>
          <p className="mt-2 text-lg text-gray-400">Extract, summarize, and edit text from images with your favorite AI.</p>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-[60vh]">
          <div className="flex flex-col">
             <OcrSettings 
                context={ocrContext} 
                onContextChange={setOcrContext}
                quality={ocrQuality}
                onQualityChange={setOcrQuality}
                llm={selectedLlm}
                onLlmChange={setSelectedLlm}
             />
             <div className="flex-grow">
                <ImageUploader onImageSelected={handleFileReady} imageUrl={imageUrl} isLoading={isLoading} />
             </div>
             <ExtractionHistory 
                history={extractionHistory} 
                onClearHistory={handleClearHistory}
                expandedHistoryId={expandedHistoryId}
                onToggleExpand={handleToggleExpandHistory}
                onCopy={handleCopyToClipboard}
                onAppend={handleAppendToDocument}
             />
          </div>
          <div className="h-[60vh] lg:h-auto">
             <LivingDocument 
                title={documentTitle}
                onTitleChange={handleTitleChange}
                onSuggestTitle={handleSuggestTitle}
                isSuggestingTitle={isSuggestingTitle}
                content={livingDocument} 
                onClear={handleClearDocument}
                onContentChange={handleDocumentChange}
                onDownload={handleDownloadDocument}
                onSave={handleSaveDocument}
                hasUnsavedChanges={hasUnsavedChanges}
                onSummarize={handleSummarize}
                isSummarizing={isSummarizing}
            />
          </div>
        </main>
      </div>
    </div>
  );
}