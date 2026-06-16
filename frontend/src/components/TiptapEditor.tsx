import React, { useCallback, useEffect, useRef } from 'react';
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';
import tippy, { Instance as TippyInstance } from 'tippy.js';
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

interface MentionUser {
  id: string;
  displayName: string;
  username: string;
}

interface TiptapEditorProps {
  value?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  readOnly?: boolean;
  users?: MentionUser[];
  uploadUrl?: string; // 이미지 업로드 엔드포인트 (기본: /boards/feedbacks/upload-image)
}

// Mention suggestion list rendered via tippy
interface MentionListProps {
  items: MentionUser[];
  command: (item: { id: string; label: string }) => void;
}

class MentionList extends React.Component<MentionListProps, { selectedIndex: number }> {
  state = { selectedIndex: 0 };

  onKeyDown({ event }: { event: KeyboardEvent }) {
    if (event.key === 'ArrowUp') {
      this.setState(s => ({ selectedIndex: (s.selectedIndex + this.props.items.length - 1) % this.props.items.length }));
      return true;
    }
    if (event.key === 'ArrowDown') {
      this.setState(s => ({ selectedIndex: (s.selectedIndex + 1) % this.props.items.length }));
      return true;
    }
    if (event.key === 'Enter') {
      this.selectItem(this.state.selectedIndex);
      return true;
    }
    return false;
  }

  selectItem(index: number) {
    const item = this.props.items[index];
    if (item) {
      this.props.command({ id: item.id, label: item.displayName });
    }
  }

  render() {
    const { items } = this.props;
    if (!items.length) return null;
    return (
      <div className="mention-suggestion-list">
        {items.map((item, index) => (
          <div
            key={item.id}
            className={`mention-suggestion-item${index === this.state.selectedIndex ? ' is-selected' : ''}`}
            onMouseDown={() => this.selectItem(index)}
          >
            @{item.displayName}
          </div>
        ))}
      </div>
    );
  }
}

export const TiptapEditor: React.FC<TiptapEditorProps> = ({
  value = '',
  onChange,
  placeholder = '내용을 입력하세요. 이미지는 Ctrl+V로 붙여넣기 가능합니다.',
  minHeight = 200,
  readOnly = false,
  users = [],
  uploadUrl = '/boards/feedbacks/upload-image',
}) => {
  const { message } = App.useApp();

  const uploadImage = useCallback(async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append('image', file);
      const response = await api.post(uploadUrl, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data.url;
    } catch (error) {
      console.error('Failed to upload image:', error);
      message.error('이미지 업로드에 실패했습니다.');
      return null;
    }
  }, [message, uploadUrl]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder }),
      Mention.configure({
        HTMLAttributes: { class: 'mention' },
        suggestion: {
          items: ({ query }: { query: string }) => {
            if (!query) return users.slice(0, 8);
            const q = query.toLowerCase();
            return users
              .filter(u => u.displayName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q))
              .slice(0, 8);
          },
          render: () => {
            let component: ReactRenderer<MentionList>;
            let popup: TippyInstance[];

            return {
              onStart: (props: any) => {
                component = new ReactRenderer(MentionList, { props, editor: props.editor });
                popup = tippy('body', {
                  getReferenceClientRect: props.clientRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: 'manual',
                  placement: 'bottom-start',
                });
              },
              onUpdate: (props: any) => {
                component.updateProps(props);
                popup[0]?.setProps({ getReferenceClientRect: props.clientRect });
              },
              onKeyDown: (props: any) => {
                if (props.event.key === 'Escape') { popup[0]?.hide(); return true; }
                return (component.ref as any)?.onKeyDown(props) ?? false;
              },
              onExit: () => {
                popup[0]?.destroy();
                component.destroy();
              },
            };
          },
        },
      }),
    ],
    content: value,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      if (onChange) onChange(editor.getHTML());
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
                if (url && editor) editor.chain().focus().setImage({ src: url }).run();
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
              if (url && editor) editor.chain().focus().setImage({ src: url }).run();
            });
            return true;
          }
        }
        return false;
      },
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '');
    }
  }, [value, editor]);

  const handleImageUpload = useCallback(async (file: File) => {
    const url = await uploadImage(file);
    if (url && editor) editor.chain().focus().setImage({ src: url }).run();
    return false;
  }, [editor, uploadImage]);

  if (!editor) return null;

  return (
    <div className="tiptap-editor-wrapper">
      {!readOnly && (
        <div className="tiptap-toolbar">
          <Space size={4} wrap>
            <Tooltip title="굵게 (Ctrl+B)">
              <Button type={editor.isActive('bold') ? 'primary' : 'text'} size="small" icon={<BoldOutlined />}
                onClick={() => editor.chain().focus().toggleBold().run()} />
            </Tooltip>
            <Tooltip title="기울임 (Ctrl+I)">
              <Button type={editor.isActive('italic') ? 'primary' : 'text'} size="small" icon={<ItalicOutlined />}
                onClick={() => editor.chain().focus().toggleItalic().run()} />
            </Tooltip>
            <Tooltip title="취소선">
              <Button type={editor.isActive('strike') ? 'primary' : 'text'} size="small" icon={<StrikethroughOutlined />}
                onClick={() => editor.chain().focus().toggleStrike().run()} />
            </Tooltip>

            <Divider type="vertical" style={{ margin: '0 4px' }} />

            <Tooltip title="번호 목록">
              <Button type={editor.isActive('orderedList') ? 'primary' : 'text'} size="small" icon={<OrderedListOutlined />}
                onClick={() => editor.chain().focus().toggleOrderedList().run()} />
            </Tooltip>
            <Tooltip title="글머리 기호">
              <Button type={editor.isActive('bulletList') ? 'primary' : 'text'} size="small" icon={<UnorderedListOutlined />}
                onClick={() => editor.chain().focus().toggleBulletList().run()} />
            </Tooltip>

            <Divider type="vertical" style={{ margin: '0 4px' }} />

            <Upload accept="image/*" showUploadList={false} beforeUpload={handleImageUpload}>
              <Tooltip title="이미지 추가">
                <Button type="text" size="small" icon={<PictureOutlined />} />
              </Tooltip>
            </Upload>

            <Divider type="vertical" style={{ margin: '0 4px' }} />

            <Tooltip title="실행 취소 (Ctrl+Z)">
              <Button type="text" size="small" icon={<UndoOutlined />}
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()} />
            </Tooltip>
            <Tooltip title="다시 실행 (Ctrl+Y)">
              <Button type="text" size="small" icon={<RedoOutlined />}
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()} />
            </Tooltip>

            {users.length > 0 && (
              <>
                <Divider type="vertical" style={{ margin: '0 4px' }} />
                <Tooltip title="멘션 (@)">
                  <Button type="text" size="small"
                    style={{ fontSize: 13, fontWeight: 600 }}
                    onClick={() => editor.chain().focus().insertContent('@').run()}
                  >
                    @
                  </Button>
                </Tooltip>
              </>
            )}
          </Space>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
};

export default TiptapEditor;
