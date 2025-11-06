import prisma from '../src/config/database';

async function fixService() {
  const service = await prisma.item.findFirst({
    where: {
      name: '결제 모듈 변경',
      type: 'SERVICE'
    }
  });

  if (!service) {
    console.log('Service not found');
    return;
  }

  const project = await prisma.item.findFirst({
    where: {
      name: '이택스코리아(유지관리)',
      type: 'PROJECT'
    }
  });

  if (!project) {
    console.log('Project not found');
    return;
  }

  console.log('Before update:');
  console.log('Service: ' + service.name);
  console.log('  parentId: ' + (service.parentId || 'NULL'));
  console.log('  clientId: ' + (service.clientId || 'NULL'));

  const updated = await prisma.item.update({
    where: { id: service.id },
    data: {
      parentId: project.id,
      clientId: project.clientId,
      updatedAt: new Date()
    }
  });

  console.log('');
  console.log('After update:');
  console.log('Service: ' + updated.name);
  console.log('  parentId: ' + updated.parentId);
  console.log('  clientId: ' + updated.clientId);
  console.log('  Connected to project: ' + project.name);
  console.log('');
  console.log('Successfully connected service to project!');
}

fixService()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
