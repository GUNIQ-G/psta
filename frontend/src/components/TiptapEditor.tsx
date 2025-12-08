import React, { useCallback, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { Button, Space, Tooltip, Divider, Upload, App } from 'antd';
import './TiptapEditor.css';
import {
  BoldOutlined,
  ItalicOutlined,
  StrikethroughOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
  PictureOutlined,
  UndoOutlined,
  RedoOutlined,
} from '@ant-design/icons';
import { api } from '../api/axios';

interface TiptapEditorProps {
  value?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  readOnly?: boolean;
}

export const TiptapEditor: React.FC<TiptapEditorProps> = ({
  value = '',
  onChange,
  placeholder = '내용을 입력하세요. 이미지는 Ctrl+V로 붙여넣기 가능합니다.',
  minHeight = 200,
  readOnly = false,
}) => {
  const { message } = App.useApp();

  // Upload image to server
  const uploadImage = useCallback(async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await api.post('/feedbacks/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      return response.data.url;
    } catch (error) {
      console.error('Failed to upload image:', error);
      message.error('이미지 업로드에 실패했습니다.');
      return null;
    }
  }, [message]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({
        inline: false,
        allowBase64: false,
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: value,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      if (onChange) {
        onChange(editor.getHTML());
      }
    },
    editorProps: {
      attributes: {
        class: 'tiptap-editor-content',
        style: `min-height: ${minHeight}px`,
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;

        for (const item of items) {
          if (item.type.startsWith('image/')) {
            event.preventDefault();
            const file = item.getAsFile();
            if (file) {
              uploadImage(file).then((url) => {
                if (url && editor) {
                  editor.chain().focus().setImage({ src: url }).run();
                }
              });
            }
            return true;
          }
        }
        return false;
      },
      handleDrop: (view, event, slice, moved) => {
        if (moved) return false;

        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;

        for (const file of files) {
          if (file.type.startsWith('image/')) {
            event.preventDefault();
            uploadImage(file).then((url) => {
              if (url && editor) {
                editor.chain().focus().setImage({ src: url }).run();
              }
            });
            return true;
          }
        }
        return false;
      },
    },
  });

  // Update content when value prop changes
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  // Handle file upload from button
  const handleImageUpload = useCallback(async (file: File) => {
    const url = await uploadImage(file);
    if (url && editor) {
      editor.chain().focus().setImage({ src: url }).run();
    }
    return false; // Prevent default upload
  }, [editor, uploadImage]);

  if (!editor) return null;

  return (
    <div className="tiptap-editor-wrapper">
      {/* Toolbar */}
      {!readOnly && (
        <div className="tiptap-toolbar">
          <Space size={4} wrap>
            <Tooltip title="굵게 (Ctrl+B)">
              <Button
                type={editor.isActive('bold') ? 'primary' : 'text'}
                size="small"
                icon={<BoldOutlined />}
                onClick={() => editor.chain().focus().toggleBold().run()}
              />
            </Tooltip>
            <Tooltip title="기울임 (Ctrl+I)">
              <Button
                type={editor.isActive('italic') ? 'primary' : 'text'}
                size="small"
                icon={<ItalicOutlined />}
                onClick={() => editor.chain().focus().toggleItalic().run()}
              />
            </Tooltip>
            <Tooltip title="취소선">
              <Button
                type={editor.isActive('strike') ? 'primary' : 'text'}
                size="small"
                icon={<StrikethroughOutlined />}
                onClick={() => editor.chain().focus().toggleStrike().run()}
              />
            </Tooltip>

            <Divider type="vertical" style={{ margin: '0 4px' }} />

            <Tooltip title="번호 목록">
              <Button
                type={editor.isActive('orderedList') ? 'primary' : 'text'}
                size="small"
                icon={<OrderedListOutlined />}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
              />
            </Tooltip>
            <Tooltip title="글머리 기호">
              <Button
                type={editor.isActive('bulletList') ? 'primary' : 'text'}
                size="small"
                icon={<UnorderedListOutlined />}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
              />
            </Tooltip>

            <Divider type="vertical" style={{ margin: '0 4px' }} />

            <Upload
              accept="image/*"
              showUploadList={false}
              beforeUpload={handleImageUpload}
            >
              <Tooltip title="이미지 추가">
                <Button type="text" size="small" icon={<PictureOutlined />} />
              </Tooltip>
            </Upload>

            <Divider type="vertical" style={{ margin: '0 4px' }} />

            <Tooltip title="실행 취소 (Ctrl+Z)">
              <Button
                type="text"
                size="small"
                icon={<UndoOutlined />}
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
              />
            </Tooltip>
            <Tooltip title="다시 실행 (Ctrl+Y)">
              <Button
                type="text"
                size="small"
                icon={<RedoOutlined />}
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
              />
            </Tooltip>
          </Space>
        </div>
      )}

      {/* Editor Content */}
      <EditorContent editor={editor} />
    </div>
  );
};

export default TiptapEditor;
