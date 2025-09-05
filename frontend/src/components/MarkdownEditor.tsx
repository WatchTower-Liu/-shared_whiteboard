import React, { useState, useRef, useEffect } from 'react';
import markdownit from 'markdown-it';
import markdownitKatex from '@traptitech/markdown-it-katex';
import 'katex/dist/katex.min.css';
import './MarkdownEditor.css';

const md = markdownit({
  html: true,
  linkify: true,
  typographer: true
}).use(markdownitKatex, {
  throwOnError: false,
  errorColor: '#cc0000'
});

interface MarkdownEditorProps {
  id: string;
  initialContent: string;
  x: number;
  y: number;
  onSave: (content: string) => void;
  onDelete: () => void;
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  id,
  initialContent,
  x,
  y,
  onSave,
  onDelete
}) => {
  const [content, setContent] = useState(initialContent);
  const [isEditing, setIsEditing] = useState(!initialContent);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x, y });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  const handleSave = () => {
    if (content.trim()) {
      onSave(content);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    if (initialContent) {
      setContent(initialContent);
      setIsEditing(false);
    } else {
      onDelete();
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Check if clicking on header or its children (but not buttons)
    const target = e.target as HTMLElement;
    const isHeaderClick = headerRef.current?.contains(target);
    const isButtonClick = target.tagName === 'BUTTON' || target.closest('button');
    
    if (!isEditing && isHeaderClick && !isButtonClick) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStart]);

  const renderContent = () => {
    try {
      return { __html: md.render(content) };
    } catch (error) {
      return { __html: `<p style="color: red;">Error rendering markdown: ${error}</p>` };
    }
  };

  return (
    <div
      ref={containerRef}
      className={`markdown-editor ${isDragging ? 'dragging' : ''}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`
      }}
    >
      <div 
        ref={headerRef}
        className="markdown-header"
        onMouseDown={handleMouseDown}
      >
        <span className="markdown-title">Markdown Block</span>
        <div className="markdown-actions">
          {!isEditing && (
            <button onClick={() => setIsEditing(true)} className="edit-btn">
              ✏️
            </button>
          )}
          <button onClick={onDelete} className="delete-btn">
            🗑️
          </button>
        </div>
      </div>
      
      {isEditing ? (
        <div className="markdown-edit-mode">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter markdown text... Use $...$ for inline math and $$...$$ for block math"
            className="markdown-textarea"
            autoFocus
          />
          <div className="markdown-preview">
            <div dangerouslySetInnerHTML={renderContent()} />
          </div>
          <div className="markdown-buttons">
            <button onClick={handleSave} className="save-btn">
              Save
            </button>
            <button onClick={handleCancel} className="cancel-btn">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="markdown-view-mode" onDoubleClick={() => setIsEditing(true)}>
          <div dangerouslySetInnerHTML={renderContent()} />
        </div>
      )}
    </div>
  );
};

export default MarkdownEditor;