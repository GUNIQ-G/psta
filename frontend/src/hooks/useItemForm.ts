import { useState, useEffect } from 'react';
import { FormInstance } from 'antd/es/form';
import { App } from 'antd';
import dayjs from 'dayjs';
import { Item, FileAttachment, Link } from '../types';
import { filesApi } from '../api/files';
import { linksApi } from '../api/links';

export const useItemForm = (
  form: FormInstance,
  item?: Item | null,
  initialEditMode?: boolean
) => {
  const { message } = App.useApp();

  const [isEditing, setIsEditing] = useState(
    initialEditMode !== undefined ? initialEditMode : !item
  );
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [relatedDocs, setRelatedDocs] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  // item 변경 시 isEditing 상태 재설정
  useEffect(() => {
    setIsEditing(!item);
  }, [item]);

  // 초기화: 폼 값 설정
  useEffect(() => {
    // item이 undefined면 아무것도 하지 않음 (모달이 닫혀있을 때)
    if (item === undefined) return;

    if (item) {
      // 수정 모드: item 값으로 폼 채우기
      form.setFieldsValue({
        name: item.name,
        type: item.type,
        status: item.status,
        progress: item.progress,
        startDate: item.startDate ? dayjs(item.startDate) : null,
        endDate: item.endDate ? dayjs(item.endDate) : null,
        description: item.description,
        assigneeId: item.assigneeId,
        clientId: item.clientId,
        parentId: item.parentId,
      });

      loadFiles(item.id);
      loadLinks(item.id);
      loadRelatedDocuments(item.id);
    } else {
      // 생성 모드: 폼 초기화 (item === null)
      form.resetFields();
      setFiles([]);
      setLinks([]);
      setRelatedDocs([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]); // form은 변하지 않으므로 의존성에서 제외

  // 파일 로드
  const loadFiles = async (itemId: string) => {
    try {
      const data = await filesApi.getItemFiles(itemId);
      setFiles(data);
    } catch (error) {
      console.error('Failed to load files:', error);
    }
  };

  // 링크 로드
  const loadLinks = async (itemId: string) => {
    try {
      const data = await linksApi.getItemLinks(itemId);
      setLinks(data);
    } catch (error) {
      console.error('Failed to load links:', error);
    }
  };

  // 관련 문서 로드
  const loadRelatedDocuments = async (itemId: string) => {
    try {
      const [filesData, linksData] = await Promise.all([
        filesApi.getItemFiles(itemId),
        linksApi.getItemLinks(itemId),
      ]);

      const combined = [
        ...filesData.map((f: any) => ({ ...f, docType: 'file' })),
        ...linksData.map((l: any) => ({ ...l, docType: 'link' })),
      ];

      setRelatedDocs(combined);
    } catch (error) {
      console.error('Failed to load related documents:', error);
    }
  };

  // 파일 업로드
  const handleFileUpload = async (file: File) => {
    if (!item) {
      message.error('항목을 먼저 저장한 후 파일을 업로드할 수 있습니다.');
      return false;
    }

    setUploading(true);
    try {
      const uploadedFile = await filesApi.uploadFile(item.id, file);
      setFiles([...files, uploadedFile]);
      loadRelatedDocuments(item.id);
      message.success('파일이 업로드되었습니다.');
    } catch (error: any) {
      message.error(error.response?.data?.message || '파일 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
    return false;
  };

  // 파일 삭제
  const handleFileDelete = async (fileId: string) => {
    try {
      await filesApi.deleteFile(fileId);
      setFiles(files.filter((f) => f.id !== fileId));
      if (item) loadRelatedDocuments(item.id);
      message.success('파일이 삭제되었습니다.');
    } catch (error: any) {
      message.error(error.response?.data?.message || '파일 삭제에 실패했습니다.');
    }
  };

  // 링크 추가 (URL과 표시명을 직접 받음)
  const handleLinkCreate = async (url: string, displayName: string) => {
    if (!item) {
      message.error('항목을 먼저 저장한 후 링크를 추가할 수 있습니다.');
      return;
    }
    try {
      const newLink = await linksApi.createLink(item.id, url, displayName);
      setLinks([...links, newLink]);
      loadRelatedDocuments(item.id);
      message.success('링크가 추가되었습니다.');
    } catch (error: any) {
      message.error(error.response?.data?.message || '링크 추가에 실패했습니다.');
    }
  };

  // 링크 삭제
  const handleLinkDelete = async (linkId: string) => {
    try {
      await linksApi.deleteLink(linkId);
      setLinks(links.filter((l) => l.id !== linkId));
      if (item) loadRelatedDocuments(item.id);
      message.success('링크가 삭제되었습니다.');
    } catch (error: any) {
      message.error(error.response?.data?.message || '링크 삭제에 실패했습니다.');
    }
  };

  // 파일 크기 포맷
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  // 조회/수정 모드 전환
  const toggleEditMode = () => {
    if (isEditing && item) {
      // 수정 취소 시 원래 값으로 복원
      form.setFieldsValue({
        name: item.name,
        status: item.status,
        progress: item.progress,
        startDate: item.startDate ? dayjs(item.startDate) : null,
        endDate: item.endDate ? dayjs(item.endDate) : null,
        description: item.description,
        assigneeId: item.assigneeId,
      });
    }
    setIsEditing(!isEditing);
  };

  return {
    form,
    isEditing,
    setIsEditing,
    files,
    setFiles,
    links,
    setLinks,
    relatedDocs,
    uploading,
    loadFiles,
    loadLinks,
    loadRelatedDocuments,
    handleFileUpload,
    handleFileDelete,
    handleLinkCreate,
    handleLinkDelete,
    formatFileSize,
    toggleEditMode,
  };
};
