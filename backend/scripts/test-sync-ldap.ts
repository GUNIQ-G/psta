import axios from 'axios';

async function testSync() {
  try {
    // You'll need a valid JWT token - for now we'll call the API
    const response = await axios.post(
      'http://localhost:3001/api/organizations/sync-from-ldap',
      {},
      {
        headers: {
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyZDg0OGNiYS04OTg3LTRlNzUtOTY0Ni03Y2Q1NGNkYmYxYzYiLCJ1c2VybmFtZSI6ImFkbWluIiwicm9sZSI6IkFETUlOIiwiaWF0IjoxNzI5NDM5MzgwfQ.p_tLAYY4A76uMDGJW7wk3IvYJa3FPaMFy8FBd5GqxRo'
        }
      }
    );

    console.log('Sync result:', response.data);
  } catch (error: any) {
    console.error('Sync failed:', error.response?.data || error.message);
  }
}

testSync();
