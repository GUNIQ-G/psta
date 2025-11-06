import prisma from '../src/config/database';
import { randomUUID } from 'crypto';

async function main() {
  console.log('Adding initial Slack configuration...');

  // Check if any config already exists
  const existing = await prisma.slackConfig.findFirst();

  if (existing) {
    console.log('Slack configuration already exists:', existing.name);
    console.log('Skipping...');
    return;
  }

  // Create the initial config - TOKENS MUST BE SET VIA WEB UI
  // DO NOT hardcode tokens here - use System Settings > Notification Apps
  const config = await prisma.slackConfig.create({
    data: {
      id: randomUUID(),
      name: 'Main Workspace',
      botToken: 'REPLACE_WITH_YOUR_BOT_TOKEN', // Set via Web UI
      appId: 'REPLACE_WITH_YOUR_APP_ID',       // Set via Web UI
      isActive: false, // Inactive until configured
      updatedAt: new Date(),
    },
  });

  console.log('✓ Slack configuration created:', config.name);
  console.log('  ID:', config.id);
  console.log('  App ID:', config.appId);
  console.log('  Active:', config.isActive);
}

main()
  .then(() => {
    console.log('\n✓ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
