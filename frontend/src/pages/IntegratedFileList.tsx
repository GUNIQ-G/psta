import React, { useState, useEffect } from 'react';
import { Table, Typography, Space, Tag, Button, message, Input, Modal, Descriptions, Tooltip } from 'antd';
import { FileOutlined, LinkOutlined, DownloadOutlined, SearchOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { filesApi } from '../api/files';
import { linksApi } from '../api/links';
import type { FileAttachment, Link } from '../types';
import dayjs from 'dayjs';

const { Title } = Typography;

interface IntegratedFile {
  id: string;
  type: 'file' | 'link';
  name: string;
  client?: string;
  project?: string;
  service?: string;
  team?: string;
  action?: string;
  uploader: string;
  createdAt: string;
  url?: string; // For links
  filepath?: string; // For files
  filesize?: number; // For files
  mimetype?: string; // For files
}

export const IntegratedFileList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<IntegratedFile[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<IntegratedFile | null>(null);

  useEffect(() => {
    fetchAllFiles();
  }, []);

  const fetchAllFiles = async () => {
    setLoading(true);
    try {
      // Fetch all files
      const fileList = await filesApi.getAllFiles();

      // Fetch all links
      const linkList = await linksApi.getAllLinks();

      // Transform files
      const transformedFiles: IntegratedFile[] = fileList.map((file: FileAttachment) => {
        const hierarchy = getHierarchyNames(file.Item);
        return {
          id: file.id,
          type: 'file',
          name: file.originalName,
          client: hierarchy.client,
          project: hierarchy.project,
          service: hierarchy.service,
          team: hierarchy.team,
          action: hierarchy.action,
          uploader: file.UploadedBy?.displayName || '-',
          createdAt: file.createdAt,
          filepath: file.filepath,
          filesize: file.filesize,
          mimetype: file.mimetype,
        };
      });

      // Transform links
      const transformedLinks: IntegratedFile[] = linkList.map((link: Link) => {
        const hierarchy = getHierarchyNames(link.Item);
        return {
          id: link.id,
          type: 'link',
          name: link.displayName,
          client: hierarchy.client,
          project: hierarchy.project,
          service: hierarchy.service,
          team: hierarchy.team,
          action: hierarchy.action,
          uploader: link.CreatedBy?.displayName || '-',
          createdAt: link.createdAt,
          url: link.url,
        };
      });

      // Combine and sort by createdAt
      const combined = [...transformedFiles, ...transformedLinks].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setFiles(combined);
    } catch (error: any) {
      message.error('파일 목록 조회 실패: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const getHierarchyNames = (item: any) => {
    let project = '-';
    let service = '-';
    let team = '-';
    let action = '-';
    let client = '-';

    if (!item) return { project, service, team, action, client };

    // Determine item type and navigate hierarchy
    switch (item.type) {
      case 'PROJECT':
        project = item.name;
        client = item.Client?.name || '-';
        break;
      case 'SERVICE':
        service = item.name;
        if (item.Item) {
          project = item.Item.name;
          client = item.Item.Client?.name || '-';
        }
        break;
      case 'TEAM':
        team = item.name;
        if (item.Item) {
          service = item.Item.name;
          if (item.Item.Item) {
            project = item.Item.Item.name;
            client = item.Item.Item.Client?.name || '-';
          }
        }
        break;
      case 'ACTION':
        action = item.name;
        if (item.Item) {
          team = item.Item.name;
          if (item.Item.Item) {
            service = item.Item.Item.name;
            if (item.Item.Item.Item) {
              project = item.Item.Item.Item.name;
              client = item.Item.Item.Item.Client?.name || '-';
            }
          }
        }
        break;
    }

    return { project, service, team, action, client };
  };

  const handleDownload = (file: IntegratedFile) => {
    if (file.type === 'file' && file.filepath) {
      const url = `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/files/download/${file.id}`;
      window.open(url, '_blank');
    } else if (file.type === 'link' && file.url) {
      window.open(file.url, '_blank');
    }
  };

  const handleBulkDownload = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('다운로드할 항목을 선택해주세요.');
      return;
    }

    const selectedFiles = files.filter(f => selectedRowKeys.includes(f.id));
    let fileCount = 0;
    let linkCount = 0;

    selectedFiles.forEach(file => {
      if (file.type === 'file') {
        fileCount++;
        handleDownload(file);
      } else {
        linkCount++;
        handleDownload(file);
      }
    });

    message.success(`${fileCount}개 파일 다운로드, ${linkCount}개 링크 열기를 시작했습니다.`);
    setSelectedRowKeys([]);
  };

  const handleShowDetail = (file: IntegratedFile) => {
    setSelectedFile(file);
    setDetailModalOpen(true);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // 검색 필터링
  const filteredFiles = files.filter((file) => {
    if (!searchText) return true;

    const searchLower = searchText.toLowerCase();
    return (
      file.name.toLowerCase().includes(searchLower) ||
      file.client?.toLowerCase().includes(searchLower) ||
      file.project?.toLowerCase().includes(searchLower) ||
      file.service?.toLowerCase().includes(searchLower) ||
      file.team?.toLowerCase().includes(searchLower) ||
      file.uploader.toLowerCase().includes(searchLower)
    );
  });

  // 고유한 값들 추출하여 필터 옵션 생성
  const getUniqueValues = (field: keyof IntegratedFile) => {
    const values = files.map(file => file[field]).filter(v => v && v !== '-');
    return Array.from(new Set(values)).sort().map(value => ({
      text: String(value),
      value: String(value),
    }));
  };

  const columns = [
    {
      title: '구분',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: string) => (
        <Tag color={type === 'file' ? 'blue' : 'green'} icon={type === 'file' ? <FileOutlined /> : <LinkOutlined />}>
          {type === 'file' ? '파일' : '링크'}
        </Tag>
      ),
      filters: [
        { text: '파일', value: 'file' },
        { text: '링크', value: 'link' },
      ],
      onFilter: (value: any, record: IntegratedFile) => record.type === value,
      sorter: (a: IntegratedFile, b: IntegratedFile) => a.type.localeCompare(b.type),
    },
    {
      title: '프로젝트',
      dataIndex: 'project',
      key: 'project',
      width: 250,
      render: (text: string) => text || '-',
      filters: getUniqueValues('project'),
      onFilter: (value: any, record: IntegratedFile) => record.project === value,
      sorter: (a: IntegratedFile, b: IntegratedFile) =>
        (a.project || '').localeCompare(b.project || ''),
    },
    {
      title: '문서명',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (text: string, record: IntegratedFile) => (
        <Space>
          {record.type === 'file' ? <FileOutlined /> : <LinkOutlined />}
          <Button type="link" onClick={() => handleShowDetail(record)} style={{ padding: 0 }}>
            {text}
          </Button>
        </Space>
      ),
      sorter: (a: IntegratedFile, b: IntegratedFile) =>
        a.name.localeCompare(b.name),
    },
    {
      title: '담당자',
      dataIndex: 'uploader',
      key: 'uploader',
      width: 120,
      filters: getUniqueValues('uploader'),
      onFilter: (value: any, record: IntegratedFile) => record.uploader === value,
      sorter: (a: IntegratedFile, b: IntegratedFile) =>
        a.uploader.localeCompare(b.uploader),
    },
    {
      title: '작성일',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
      sorter: (a: IntegratedFile, b: IntegratedFile) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    },
    {
      title: '작업',
      key: 'action',
      width: 80,
      align: 'center',
      render: (_: any, record: IntegratedFile) => (
        <Space size={8}>
          <Tooltip title="상세 정보">
            <Button
              type="text"
              size="small"
              icon={<InfoCircleOutlined />}
              onClick={() => handleShowDetail(record)}
              style={{ padding: 4 }}
            />
          </Tooltip>
          <Tooltip title={record.type === 'file' ? '다운로드' : '링크 열기'}>
            <Button
              type="text"
              size="small"
              icon={record.type === 'file' ? <DownloadOutlined /> : <LinkOutlined />}
              onClick={() => handleDownload(record)}
              style={{ padding: 4 }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (selectedKeys: React.Key[]) => {
      setSelectedRowKeys(selectedKeys);
    },
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={2} style={{ margin: 0 }}>
          통합 파일 관리
        </Title>
        <Space>
          <Input
            placeholder="문서명, 프로젝트, 담당자 검색..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{ width: 300 }}
          />
          {selectedRowKeys.length > 0 && (
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleBulkDownload}
            >
              선택 항목 다운로드 ({selectedRowKeys.length})
            </Button>
          )}
          <Button onClick={fetchAllFiles} loading={loading}>
            새로고침
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={filteredFiles}
        rowKey="id"
        loading={loading}
        rowSelection={rowSelection}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total) => `총 ${total}개`,
        }}
      />

      {/* 문서 상세 정보 모달 */}
      <Modal
        title="문서 상세 정보"
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)}>
            닫기
          </Button>,
          <Button
            key="download"
            type="primary"
            icon={selectedFile?.type === 'file' ? <DownloadOutlined /> : <LinkOutlined />}
            onClick={() => {
              if (selectedFile) handleDownload(selectedFile);
            }}
          >
            {selectedFile?.type === 'file' ? '다운로드' : '링크 열기'}
          </Button>,
        ]}
        width={700}
      >
        {selectedFile && (
          <Descriptions bordered column={2}>
            <Descriptions.Item label="구분" span={2}>
              <Tag color={selectedFile.type === 'file' ? 'blue' : 'green'} icon={selectedFile.type === 'file' ? <FileOutlined /> : <LinkOutlined />}>
                {selectedFile.type === 'file' ? '파일' : '링크'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="문서명" span={2}>
              {selectedFile.name}
            </Descriptions.Item>
            {selectedFile.type === 'file' && selectedFile.filesize && (
              <Descriptions.Item label="파일 크기" span={2}>
                {formatFileSize(selectedFile.filesize)}
              </Descriptions.Item>
            )}
            {selectedFile.type === 'file' && selectedFile.mimetype && (
              <Descriptions.Item label="파일 형식" span={2}>
                {selectedFile.mimetype}
              </Descriptions.Item>
            )}
            {selectedFile.type === 'link' && selectedFile.url && (
              <Descriptions.Item label="URL" span={2}>
                <a href={selectedFile.url} target="_blank" rel="noopener noreferrer">
                  {selectedFile.url}
                </a>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="고객" span={2}>
              {selectedFile.client || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="프로젝트" span={2}>
              {selectedFile.project && selectedFile.project !== '-' ? (
                <Tag color="#722ed1" style={{ fontSize: '13px', padding: '4px 10px' }}>
                  P: {selectedFile.project}
                </Tag>
              ) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="서비스" span={2}>
              {selectedFile.service && selectedFile.service !== '-' ? (
                <Tag color="#1890ff" style={{ fontSize: '13px', padding: '4px 10px' }}>
                  S: {selectedFile.service}
                </Tag>
              ) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="팀" span={2}>
              {selectedFile.team && selectedFile.team !== '-' ? (
                <Tag color="#52c41a" style={{ fontSize: '13px', padding: '4px 10px' }}>
                  T: {selectedFile.team}
                </Tag>
              ) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="액션" span={2}>
              {selectedFile.action && selectedFile.action !== '-' ? (
                <Tag color="#fa8c16" style={{ fontSize: '13px', padding: '4px 10px' }}>
                  A: {selectedFile.action}
                </Tag>
              ) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="담당자" span={2}>
              {selectedFile.uploader}
            </Descriptions.Item>
            <Descriptions.Item label="작성일" span={2}>
              {dayjs(selectedFile.createdAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};
