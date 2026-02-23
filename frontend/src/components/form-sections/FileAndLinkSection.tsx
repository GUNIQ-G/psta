import React, { useState } from 'react';
import { Card, List, Button, Upload, Space, Tag, Popconfirm } from 'antd';
import {
  UploadOutlined,
  LinkOutlined,
  FileOutlined,
  DownloadOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { Item, ItemType, FileAttachment, Link, User } from '../../types';
import { filesApi } from '../../api/files';
import { LinkAddModal } from '../modals/LinkAddModal';

interface FileAndLinkSectionProps {
  item?: Item | null;
  currentType?: ItemType;
  isEditing: boolean;
  files: FileAttachment[];
  links: Link[];
  uploading: boolean;
  user: User | null;
  onFileUpload: (file: File) => Promise<boolean>;
  onFileDelete: (fileId: string) => void;
  onLinkCreate: (url: string, displayName: string) => void;
  onLinkDelete: (linkId: string) => void;
  formatFileSize: (bytes: number) => string;
}

export const FileAndLinkSection: React.FC<FileAndLinkSectionProps> = ({
  item,
  currentType,
  isEditing,
  files,
  links,
  uploading,
  user,
  onFileUpload,
  onFileDelete,
  onLinkCreate,
  onLinkDelete,
  formatFileSize,
}) => {
  const [linkModalOpen, setLinkModalOpen] = useState(false);

  // TEAM 또는 ACTION 타입만 표시
  if (!item || !currentType || (currentType !== ItemType.TEAM && currentType !== ItemType.ACTION)) {
    return null;
  }

  const handleLinkAdd = () => {
    setLinkModalOpen(true);
  };

  const handleLinkSubmit = (url: string, displayName: string) => {
    onLinkCreate(url, displayName);
    setLinkModalOpen(false);
  };

  return (
    <>
      <Card
        title={
          <Space>
            <span style={{ fontWeight: 600 }}>첨부 파일 & 링크</span>
            <Tag color="blue">{files.length + links.length}</Tag>
          </Space>
        }
        extra={
          isEditing && (
            <Space>
              <Upload beforeUpload={onFileUpload} showUploadList={false} disabled={uploading}>
                <Button type="primary" size="small" icon={<UploadOutlined />} loading={uploading}>
                  파일 업로드
                </Button>
              </Upload>
              <Button
                type="primary"
                size="small"
                icon={<LinkOutlined />}
                onClick={handleLinkAdd}
                style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
              >
                링크 추가
              </Button>
            </Space>
          )
        }
        size="small"
        styles={{ body: { padding: files.length + links.length > 0 ? '12px' : '24px 12px' } }}
      >
        {files.length + links.length > 0 ? (
          <List
            size="small"
            dataSource={[
              ...files.map((file) => ({ type: 'file' as const, data: file })),
              ...links.map((link) => ({ type: 'link' as const, data: link })),
            ]}
            renderItem={(listItem) => {
              const isFile = listItem.type === 'file';
              const data = listItem.data as any;
              const canDelete =
                user?.role === 'ADMIN' || user?.id === (isFile ? data.uploadedById : data.createdById);

              return (
                <List.Item
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    marginBottom: '8px',
                    backgroundColor: '#fafafa',
                    border: '1px solid #f0f0f0',
                  }}
                  actions={[
                    isFile ? (
                      <Button
                        type="text"
                        size="small"
                        icon={<DownloadOutlined />}
                        href={filesApi.getFileUrl(data.filename)}
                        target="_blank"
                        style={{ color: '#1890ff' }}
                      />
                    ) : (
                      <Button
                        type="text"
                        size="small"
                        icon={<LinkOutlined />}
                        href={data.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#52c41a' }}
                      />
                    ),
                    isEditing &&
                      canDelete && (
                        <Popconfirm
                          title={isFile ? '파일 삭제' : '링크 삭제'}
                          description={`이 ${isFile ? '파일' : '링크'}을 삭제하시겠습니까?`}
                          onConfirm={() => (isFile ? onFileDelete(data.id) : onLinkDelete(data.id))}
                          okText="삭제"
                          cancelText="취소"
                        >
                          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      ),
                  ].filter(Boolean)}
                >
                  <List.Item.Meta
                    avatar={
                      isFile ? (
                        <FileOutlined style={{ fontSize: 18, color: '#1890ff' }} />
                      ) : (
                        <LinkOutlined style={{ fontSize: 18, color: '#52c41a' }} />
                      )
                    }
                    title={
                      <Space size={8}>
                        <Tag
                          color={isFile ? 'blue' : 'green'}
                          style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontWeight: 600,
                            marginRight: 0,
                          }}
                        >
                          {isFile ? '파일' : '링크'}
                        </Tag>
                        <div
                          style={{
                            fontSize: '13px',
                            fontWeight: 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                          }}
                        >
                          {isFile ? data.originalName : data.displayName}
                        </div>
                      </Space>
                    }
                    description={
                      <div style={{ fontSize: '11px', color: '#8c8c8c', marginLeft: '48px' }}>
                        {isFile ? (
                          <>
                            {formatFileSize(data.filesize)} • {data.UploadedBy?.displayName || '알 수 없음'}
                          </>
                        ) : (
                          <>
                            <span style={{ color: '#1890ff' }}>{data.url}</span> •{' '}
                            {data.CreatedBy?.displayName || '알 수 없음'}
                          </>
                        )}
                      </div>
                    }
                  />
                </List.Item>
              );
            }}
          />
        ) : (
          <div style={{ textAlign: 'center', color: '#bfbfbf', padding: '12px 0' }}>
            <p style={{ margin: 0 }}>첨부된 파일이나 링크가 없습니다.</p>
          </div>
        )}
      </Card>

      {/* 링크 추가 모달 (공통 컴포넌트) */}
      <LinkAddModal
        open={linkModalOpen}
        onCancel={() => setLinkModalOpen(false)}
        onSubmit={handleLinkSubmit}
      />
    </>
  );
};
