import React from 'react';
import { Dropdown, Button, Upload } from 'antd';
import { SettingOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import type { MenuProps, UploadFile } from 'antd';

interface PstaSettingsDropdownProps {
  onExport: () => void;
  onImport: (file: UploadFile) => boolean;
}

export const PstaSettingsDropdown: React.FC<PstaSettingsDropdownProps> = ({
  onExport,
  onImport,
}) => {
  const items: MenuProps['items'] = [
    {
      key: 'export',
      label: '내보내기',
      icon: <DownloadOutlined />,
      onClick: onExport,
    },
    {
      key: 'import',
      label: (
        <Upload
          accept=".xlsx,.xls"
          showUploadList={false}
          beforeUpload={onImport}
        >
          <span>가져오기</span>
        </Upload>
      ),
      icon: <UploadOutlined />,
    },
  ];

  return (
    <Dropdown
      menu={{ items }}
      trigger={['click']}
      placement="bottomRight"
    >
      <Button icon={<SettingOutlined />}>
        작업
      </Button>
    </Dropdown>
  );
};
