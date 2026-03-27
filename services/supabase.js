'use strict';

const axios = require('axios');

const API_BASE   = 'https://api.supabase.com/v1';
const TIMEOUT_MS = 30000;

async function apiCall(method, urlPath, accessToken, data, logger, actionName) {
  const url = API_BASE + urlPath;
  try {
    const response = await axios({
      method,
      url,
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
      },
      data: data || undefined,
      timeout: TIMEOUT_MS,
    });
    return response.data;
  } catch (err) {
    if (err.code === 'ECONNABORTED') {
      throw new Error('TIMEOUT: ' + actionName + ' vuot qua ' + (TIMEOUT_MS / 1000) + 's');
    }
    if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
      throw new Error('Khong ket duoc mang: ' + err.message);
    }
    if (err.response) {
      const status = err.response.status;
      const msg =
        (err.response.data && (err.response.data.message || err.response.data.error)) ||
        err.response.statusText ||
        'Unknown API error';
      throw new Error(status + ': ' + msg);
    }
    throw err;
  }
}

async function apiCallWithFallback(method, urlPaths, accessToken, data, logger, actionName) {
  let lastError = null;
  for (const path of urlPaths) {
    try {
      return await apiCall(method, path, accessToken, data, logger, actionName);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Khong goi duoc endpoint nao cho action ' + actionName);
}

function getAccessToken(profile) {
  return profile.credentials && profile.credentials.accessToken;
}

function getDefaultDbPass(profile) {
  return (
    (profile.meta && profile.meta.default_db_pass) ||
    (profile._defaults && profile._defaults.default_db_pass) ||
    ''
  );
}

const actions = {
  listProjects: {
    description: 'Liet ke tat ca projects trong tai khoan Supabase',
    params: [],
    async execute(profile, params, logger) {
      const token = profile.credentials && profile.credentials.accessToken;
      if (!token) return { success: false, data: null, message: 'Thieu credentials.accessToken trong profile' };
      try {
        const data  = await apiCall('GET', '/projects', token, null, logger, 'listProjects');
        const count = Array.isArray(data) ? data.length : '?';
        return { success: true, data, message: 'Tim thay ' + count + ' project(s)' };
      } catch (err) {
        return { success: false, data: null, message: err.message };
      }
    },
  },

  createProject: {
    description: 'Tao project Supabase moi',
    params: [
      { name: 'name',            required: true,  description: 'Ten project' },
      { name: 'organization_id', required: true,  description: 'ID cua organization' },
      { name: 'db_pass',         required: true,  description: 'Mat khau database' },
      { name: 'region',          required: false, description: 'Region (mac dinh: ap-southeast-1)' },
      { name: 'plan',            required: false, description: 'Plan: free | pro (mac dinh: free)' },
    ],
    async execute(profile, params, logger) {
      const token = getAccessToken(profile);
      if (!token) return { success: false, data: null, message: 'Thieu credentials.accessToken trong profile' };

      const missing = [];
      if (!params.name)            missing.push('name');
      if (!params.organization_id) missing.push('organization_id');
      const dbPass = params.db_pass || getDefaultDbPass(profile);
      if (!dbPass)                 missing.push('db_pass (hoac meta.default_db_pass)');
      if (missing.length > 0) return { success: false, data: null, message: 'Thieu params bat buoc: ' + missing.join(', ') };

      const body = {
        name:            params.name,
        organization_id: params.organization_id,
        db_pass:         dbPass,
        region:          params.region || 'ap-southeast-1',
        plan:            params.plan   || 'free',
      };

      try {
        const data = await apiCall('POST', '/projects', token, body, logger, 'createProject');
        return { success: true, data, message: "Da tao project '" + (data.name || params.name) + "' (ref: " + (data.id || '?') + ')' };
      } catch (err) {
        return { success: false, data: null, message: err.message };
      }
    },
  },

  getProjectApiKeys: {
    description: 'Lay API keys cua mot project',
    params: [
      { name: 'project_ref', required: true, description: 'Reference ID cua project' },
    ],
    async execute(profile, params, logger) {
      const token = getAccessToken(profile);
      if (!token) return { success: false, data: null, message: 'Thieu credentials.accessToken trong profile' };
      if (!params.project_ref) return { success: false, data: null, message: 'Thieu param: project_ref' };

      try {
        const data     = await apiCall('GET', '/projects/' + params.project_ref + '/api-keys', token, null, logger, 'getProjectApiKeys');
        const keyCount = Array.isArray(data) ? data.length : '?';
        return { success: true, data, message: 'Lay duoc ' + keyCount + ' API key(s) cho project ' + params.project_ref };
      } catch (err) {
        return { success: false, data: null, message: err.message };
      }
    },
  },

  pauseProject: {
    description: 'Tam dung (pause) mot project Supabase',
    params: [
      { name: 'project_ref', required: true, description: 'Reference ID cua project' },
    ],
    async execute(profile, params, logger) {
      const token = getAccessToken(profile);
      if (!token) return { success: false, data: null, message: 'Thieu credentials.accessToken trong profile' };
      if (!params.project_ref) return { success: false, data: null, message: 'Thieu param: project_ref' };

      try {
        const data = await apiCall('POST', '/projects/' + params.project_ref + '/pause', token, null, logger, 'pauseProject');
        return { success: true, data, message: 'Da gui lenh pause cho project ' + params.project_ref };
      } catch (err) {
        return { success: false, data: null, message: err.message };
      }
    },
  },

  restoreProject: {
    description: 'Khoi phuc (restore) mot project Supabase da bi pause',
    params: [
      { name: 'project_ref', required: true, description: 'Reference ID cua project' },
    ],
    async execute(profile, params, logger) {
      const token = getAccessToken(profile);
      if (!token) return { success: false, data: null, message: 'Thieu credentials.accessToken trong profile' };
      if (!params.project_ref) return { success: false, data: null, message: 'Thieu param: project_ref' };

      try {
        const data = await apiCall('POST', '/projects/' + params.project_ref + '/restore', token, null, logger, 'restoreProject');
        return { success: true, data, message: 'Da gui lenh restore cho project ' + params.project_ref };
      } catch (err) {
        return { success: false, data: null, message: err.message };
      }
    },
  },

  listStorageBuckets: {
    description: 'Lay danh sach bucket cua project',
    params: [
      { name: 'project_ref', required: true, description: 'Reference ID cua project' },
    ],
    async execute(profile, params, logger) {
      const token = getAccessToken(profile);
      if (!token) return { success: false, data: null, message: 'Thieu credentials.accessToken trong profile' };
      if (!params.project_ref) return { success: false, data: null, message: 'Thieu param: project_ref' };

      try {
        const data = await apiCallWithFallback(
          'GET',
          [
            '/projects/' + params.project_ref + '/storage/buckets',
            '/projects/' + params.project_ref + '/buckets',
          ],
          token,
          null,
          logger,
          'listStorageBuckets'
        );
        return { success: true, data, message: 'Lay duoc danh sach bucket cho project ' + params.project_ref };
      } catch (err) {
        return { success: false, data: null, message: err.message };
      }
    },
  },

  createStorageBucket: {
    description: 'Tao bucket moi trong project',
    params: [
      { name: 'project_ref', required: true, description: 'Reference ID cua project' },
      { name: 'name', required: true, description: 'Ten bucket' },
      { name: 'public', required: false, description: 'Bucket public (true/false)' },
    ],
    async execute(profile, params, logger) {
      const token = getAccessToken(profile);
      if (!token) return { success: false, data: null, message: 'Thieu credentials.accessToken trong profile' };

      const missing = [];
      if (!params.project_ref) missing.push('project_ref');
      if (!params.name) missing.push('name');
      if (missing.length > 0) return { success: false, data: null, message: 'Thieu params bat buoc: ' + missing.join(', ') };

      const body = {
        name: params.name,
        public: String(params.public || 'false').toLowerCase() === 'true',
      };

      try {
        const data = await apiCallWithFallback(
          'POST',
          [
            '/projects/' + params.project_ref + '/storage/buckets',
            '/projects/' + params.project_ref + '/buckets',
          ],
          token,
          body,
          logger,
          'createStorageBucket'
        );
        return { success: true, data, message: "Da tao bucket '" + params.name + "' cho project " + params.project_ref };
      } catch (err) {
        return { success: false, data: null, message: err.message };
      }
    },
  },

  getPostgresConnection: {
    description: 'Lay thong tin ket noi Postgres cua project',
    params: [
      { name: 'project_ref', required: true, description: 'Reference ID cua project' },
    ],
    async execute(profile, params, logger) {
      const token = getAccessToken(profile);
      if (!token) return { success: false, data: null, message: 'Thieu credentials.accessToken trong profile' };
      if (!params.project_ref) return { success: false, data: null, message: 'Thieu param: project_ref' };

      try {
        const data = await apiCallWithFallback(
          'GET',
          [
            '/projects/' + params.project_ref + '/database',
            '/projects/' + params.project_ref + '/database/postgres',
            '/projects/' + params.project_ref + '/database/connection',
          ],
          token,
          null,
          logger,
          'getPostgresConnection'
        );
        return { success: true, data, message: 'Lay duoc cau hinh Postgres cho project ' + params.project_ref };
      } catch (err) {
        return { success: false, data: null, message: err.message };
      }
    },
  },

  getProjectConnectionBundle: {
    description: 'Tong hop thong tin ket noi Postgres + bucket/S3',
    params: [
      { name: 'project_ref', required: true, description: 'Reference ID cua project' },
    ],
    async execute(profile, params, logger) {
      const token = getAccessToken(profile);
      if (!token) return { success: false, data: null, message: 'Thieu credentials.accessToken trong profile' };
      if (!params.project_ref) return { success: false, data: null, message: 'Thieu param: project_ref' };

      const projectRef = params.project_ref;
      const out = {
        project_ref: projectRef,
        postgres: null,
        api_keys: null,
        buckets: null,
        s3: {
          endpoint: `https://${projectRef}.supabase.co/storage/v1/s3`,
          region: 'auto',
          note: 'Secret/Access Key can duoc cap tu dashboard hoac endpoint S3 credentials neu workspace ho tro.',
        },
      };

      try {
        out.postgres = await apiCallWithFallback(
          'GET',
          [
            '/projects/' + projectRef + '/database',
            '/projects/' + projectRef + '/database/postgres',
            '/projects/' + projectRef + '/database/connection',
          ],
          token,
          null,
          logger,
          'getProjectConnectionBundle/postgres'
        );
      } catch (_) {}

      try {
        out.api_keys = await apiCall('GET', '/projects/' + projectRef + '/api-keys', token, null, logger, 'getProjectConnectionBundle/api-keys');
      } catch (_) {}

      try {
        out.buckets = await apiCallWithFallback(
          'GET',
          [
            '/projects/' + projectRef + '/storage/buckets',
            '/projects/' + projectRef + '/buckets',
          ],
          token,
          null,
          logger,
          'getProjectConnectionBundle/buckets'
        );
      } catch (_) {}

      return {
        success: true,
        data: out,
        message: 'Da tong hop thong tin ket noi cho project ' + projectRef,
      };
    },
  },

  createProjectWithSetup: {
    description: 'Tao project va setup bucket/cofig ket noi co ban',
    params: [
      { name: 'name', required: true, description: 'Ten project' },
      { name: 'organization_id', required: false, description: 'Organization ID (fallback tu profile.meta.organization_id)' },
      { name: 'db_pass', required: false, description: 'Mat khau DB (fallback tu profile.meta.default_db_pass)' },
      { name: 'bucket_name', required: false, description: 'Ten bucket can tao sau khi tao project' },
      { name: 'region', required: false, description: 'Region (mac dinh: ap-southeast-1)' },
      { name: 'plan', required: false, description: 'Plan: free | pro' },
    ],
    async execute(profile, params, logger) {
      const token = getAccessToken(profile);
      if (!token) return { success: false, data: null, message: 'Thieu credentials.accessToken trong profile' };

      const organizationId = params.organization_id || (profile.meta && profile.meta.organization_id);
      const dbPass = params.db_pass || getDefaultDbPass(profile);
      const missing = [];
      if (!params.name) missing.push('name');
      if (!organizationId) missing.push('organization_id (hoac meta.organization_id)');
      if (!dbPass) missing.push('db_pass (hoac meta.default_db_pass)');
      if (missing.length > 0) return { success: false, data: null, message: 'Thieu params bat buoc: ' + missing.join(', ') };

      try {
        const created = await apiCall(
          'POST',
          '/projects',
          token,
          {
            name: params.name,
            organization_id: organizationId,
            db_pass: dbPass,
            region: params.region || 'ap-southeast-1',
            plan: params.plan || 'free',
          },
          logger,
          'createProjectWithSetup/createProject'
        );

        const projectRef = created.id || created.ref || created.project_ref;
        const result = {
          project: created,
          postgres: null,
          api_keys: null,
          bucket: null,
          s3: null,
        };

        if (projectRef && params.bucket_name) {
          try {
            result.bucket = await apiCallWithFallback(
              'POST',
              ['/projects/' + projectRef + '/storage/buckets', '/projects/' + projectRef + '/buckets'],
              token,
              { name: params.bucket_name, public: false },
              logger,
              'createProjectWithSetup/createBucket'
            );
          } catch (bucketErr) {
            result.bucket = { error: bucketErr.message };
          }
        }

        if (projectRef) {
          try {
            result.postgres = await apiCallWithFallback(
              'GET',
              ['/projects/' + projectRef + '/database', '/projects/' + projectRef + '/database/postgres', '/projects/' + projectRef + '/database/connection'],
              token,
              null,
              logger,
              'createProjectWithSetup/getPostgres'
            );
          } catch (_) {}

          try {
            result.api_keys = await apiCall('GET', '/projects/' + projectRef + '/api-keys', token, null, logger, 'createProjectWithSetup/getKeys');
          } catch (_) {}

          result.s3 = {
            endpoint: `https://${projectRef}.supabase.co/storage/v1/s3`,
            region: 'auto',
          };
        }

        return { success: true, data: result, message: "Da tao project '" + params.name + "' va hoan tat setup co ban" };
      } catch (err) {
        return { success: false, data: null, message: err.message };
      }
    },
  },
};

module.exports = {
  name:       'supabase',
  displayName: 'Supabase',
  version:    '1.0.0',
  apiBaseUrl: API_BASE,
  configSchema: {
    required: ['credentials.accessToken'],
    optional: ['meta.organization_id', 'meta.default_db_pass'],
  },
  actions,
};
