import React, { useState } from 'react';
import { Modal, Form, Input, App } from 'antd';
import { SearchOutlined, LoadingOutlined } from '@ant-design/icons';
import { linksApi } from '../../api/links';

interface LinkAddModalProps {
  open: boolean;
  onCancel: () => void;
  onSubmit: (url: string, displayName: string) => void;
}

export const LinkAddModal: React.FC<LinkAddModalProps> = ({
  open,
  onCancel,
  onSubmit,
}) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [fetchingTitle, setFetchingTitle] = useState(false);

  // URL에서 문서명 자동 조회
  const handleFetchTitle = async () => {
    const url = form.getFieldValue('url');
    if (!url) {
      message.warning('URL을 먼저 입력해주세요');
      return;
    }

    // URL 유효성 검사
    try {
      new URL(url);
    } catch {
      message.error('올바른 URL 형식이 아닙니다');
      return;
    }

    setFetchingTitle(true);
    try {
      const result = await linksApi.fetchTitle(url);
      if (result.title) {
        form.setFieldsValue({ displayName: result.title });
        message.success('문서명을 가져왔습니다');
      }
    } catch (error) {
      message.error('문서명을 가져오는데 실패했습니다');
    } finally {
      setFetchingTitle(false);
    }
  };

  // URL 입력 후 자동 조회 (onBlur)
  const handleUrlBlur = () => {
    const url = form.getFieldValue('url');
    const displayName = form.getFieldValue('displayName');

    // URL이 있고, displayName이 비어있을 때만 자동 조회
    if (url && !displayName) {
      try {
        new URL(url);
        handleFetchTitle();
      } catch {
        // 유효하지 않은 URL이면 무시
      }
    }
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      onSubmit(values.url, values.displayName);
      form.resetFields();
    } catch {
      // Form validation error
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title="링크 추가"
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      okText="추가"
      cancelText="취소"
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="url"
          label="URL"
          rules={[
            { required: true, message: 'URL을 입력해주세요' },
            { type: 'url', message: '올바른 URL 형식이 아닙니다' },
          ]}
          extra="Nextcloud 등 공유 링크를 입력하면 문서명을 자동으로 가져옵니다"
        >
          <Input.Search
            placeholder="https://..."
            enterButton={fetchingTitle ? <LoadingOutlined /> : <SearchOutlined />}
            onSearch={handleFetchTitle}
            onBlur={handleUrlBlur}
            loading={fetchingTitle}
          />
        </Form.Item>
        <Form.Item
          name="displayName"
          label="표시명"
          rules={[{ required: true, message: '표시명을 입력해주세요' }]}
        >
          <Input placeholder="자동으로 입력되거나 직접 입력하세요" />
        </Form.Item>
      </Form>
    </Modal>
  );
};
