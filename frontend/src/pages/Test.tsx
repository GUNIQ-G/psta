import React from 'react';
import { Typography, Card } from 'antd';

const { Title, Paragraph } = Typography;

export const Test: React.FC = () => {
  return (
    <div>
      <Title level={2}>테스트 페이지</Title>
      <Card>
        <Paragraph>
          이곳은 테스트를 위한 페이지입니다.
        </Paragraph>
      </Card>
    </div>
  );
};
