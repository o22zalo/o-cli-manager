'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const axios = require('axios');

const API_BASE = 'https://api.supabase.com/v1';
const TIMEOUT_MS = 30000;

function getSupabaseConfigPath() {
  return path.join(process.cwd(), 'configs', 'supabase.yaml');
}

function readSupabaseConfig() {
  const configPath = getSupabaseConfigPath();
  if (!fs.existsSync(configPath)) return null;
  return yaml.load(fs.readFileSync(configPath, 'utf8'));
}

function writeSupabaseConfig(config) {
  const configPath = getSupabaseConfigPath();
  fs.writeFileSync(configPath, yaml.dump(config, { indent: 2 }), 'utf8');
}

function persistProfileData(profileName, updater) {
  if (!profileName) return;
  const config = readSupabaseConfig();
  if (!config || !Array.isArray(config.profiles)) return;

  const profile = config.profiles.find((p) => p.name === profileName);
  if (!profile) return;

  updater(profile);
  writeSupabaseConfig(config);
}

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
  for (const endpointPath of urlPaths) {
    try {
      return await apiCall(method, endpointPath, accessToken, data, logger, actionName);
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
    (profile.meta && (profile.meta.project_pass || profile.meta.default_db_pass)) ||
    (profile._defaults && (profile._defaults.project_pass || profile._defaults.default_db_pass)) ||
    ''
  );
}

function getDefaultRegion(profile) {
  return (
    (profile.meta && profile.meta.region_selection && profile.meta.region_selection.code) ||
    (profile._defaults && profile._defaults.region_selection && profile._defaults.region_selection.code) ||
    'ap-southeast-1'
  );
}

async function resolveOrganizationId(profile, logger) {
  if (profile.meta && profile.meta.organization_id) return profile.meta.organization_id;

  const token = getAccessToken(profile);
  const organizations = await apiCall('GET', '/organizations', token, null, logger, 'resolveOrganizationId');

  if (!Array.isArray(organizations) || organizations.length === 0) {
    throw new Error('Khong tim thay organization nao trong tai khoan Supabase');
  }

  const organizationId = organizations[0].id;

  profile.meta = profile.meta || {};
  profile.meta.organization_id = organizationId;
  profile.meta.organizations = organizations;

  persistProfileData(profile.name, (targetProfile) => {
    targetProfile.meta = targetProfile.meta || {};
    targetProfile.meta.organization_id = organizationId;
    targetProfile.meta.organizations = organizations;
  });

  return organizationId;
}

function buildS3Descriptor(projectRef) {
  return {
    endpoint: `https://${projectRef}.supabase.co/storage/v1/s3`,
    region: 'auto',
    note: 'Secret/Access Key can duoc cap tu dashboard hoac endpoint S3 credentials neu workspace ho tro.',
  };
}

function persistConnectionBundle(profile, bundle) {
  persistProfileData(profile.name, (targetProfile) => {
    targetProfile.cache = targetProfile.cache || {};
    targetProfile.cache.last_connection_bundle = {
      at: new Date().toISOString(),
      ...bundle,
    };
  });
}

async function verifyBucketRoundTrip(projectRef, bucketName, token, logger) {
  const keys = await apiCall('GET', '/projects/' + projectRef + '/api-keys', token, null, logger, 'verifyStorageBucketRW/getKeys');
  const serviceRole = Array.isArray(keys)
    ? keys.find((k) => String(k.name || '').toLowerCase().includes('service_role'))
    : null;

  if (!serviceRole || !serviceRole.api_key) {
    throw new Error('Khong lay duoc service_role key de kiem thu bucket');
  }

  const probeFile = 'probe-' + Date.now() + '.txt';
  const storageBase = `https://${projectRef}.supabase.co/storage/v1/object/${bucketName}/${probeFile}`;

  await axios({
    method: 'POST',
    url: storageBase,
    data: 'supabase-bucket-probe',
    headers: {
      apikey: serviceRole.api_key,
      Authorization: 'Bearer ' + serviceRole.api_key,
      'Content-Type': 'text/plain',
      'x-upsert': 'true',
    },
    timeout: TIMEOUT_MS,
  });

  await axios({
    method: 'DELETE',
    url: storageBase,
    headers: {
      apikey: serviceRole.api_key,
      Authorization: 'Bearer ' + serviceRole.api_key,
    },
    timeout: TIMEOUT_MS,
  });

  return { success: true, probe_file: probeFile, message: 'Upload/Delete thanh cong' };
}

const actions = {
  listProjects: {
    description: 'Liet ke tat ca projects trong tai khoan Supabase',
    params: [],
    async execute(profile, params, logger) {
      const token = getAccessToken(profile);
      if (!token) return { success: false, data: null, message: 'Thieu credentials.accessToken trong profile' };
      try {
        const data = await apiCall('GET', '/projects', token, null, logger, 'listProjects');
        const count = Array.isArray(data) ? data.length : '?';
        return { success: true, data, message: 'Tim thay ' + count + ' project(s)' };
      } catch (err) {
        return { success: false, data: null, message: err.message };
      }
    },
  },

  listOrganizations: {
    description: 'Lay organizations va luu vao profile neu chua co organization_id',
    params: [],
    async execute(profile, params, logger) {
      const token = getAccessToken(profile);
      if (!token) return { success: false, data: null, message: 'Thieu credentials.accessToken trong profile' };

      try {
        if (profile.meta && profile.meta.organization_id && Array.isArray(profile.meta.organizations)) {
          return {
            success: true,
            data: profile.meta.organizations,
            message: 'Profile da co organizations cache, bo qua goi API',
          };
        }

        const organizations = await apiCall('GET', '/organizations', token, null, logger, 'listOrganizations');
        const firstOrgId = Array.isArray(organizations) && organizations[0] ? organizations[0].id : '';

        profile.meta = profile.meta || {};
        if (!profile.meta.organization_id && firstOrgId) {
          profile.meta.organization_id = firstOrgId;
        }
        profile.meta.organizations = organizations;

        persistProfileData(profile.name, (targetProfile) => {
          targetProfile.meta = targetProfile.meta || {};
          if (!targetProfile.meta.organization_id && firstOrgId) {
            targetProfile.meta.organization_id = firstOrgId;
          }
          targetProfile.meta.organizations = organizations;
        });

        return {
          success: true,
          data: organizations,
          message: 'Da dong bo organizations vao config profile ' + profile.name,
        };
      } catch (err) {
        return { success: false, data: null, message: err.message };
      }
    },
  },

  createProject: {
    description: 'Tao project Supabase moi',
    params: [
      { name: 'name', required: true, description: 'Ten project' },
      { name: 'organization_id', required: false, description: 'ID cua organization (tu dong resolve neu de trong)' },
      { name: 'db_pass', required: false, description: 'Mat khau database (fallback profile.meta.project_pass/default_db_pass)' },
      { name: 'region', required: false, description: 'Region (mac dinh theo region_selection.code)' },
      { name: 'plan', required: false, description: 'Plan: free | pro (mac dinh: free)' },
    ],
    async execute(profile, params, logger) {
      const token = getAccessToken(profile);
      if (!token) return { success: false, data: null, message: 'Thieu credentials.accessToken trong profile' };

      const missing = [];
      if (!params.name) missing.push('name');
      const dbPass = params.db_pass || getDefaultDbPass(profile);
      if (!dbPass) missing.push('db_pass (hoac meta.project_pass/default_db_pass)');
      if (missing.length > 0) return { success: false, data: null, message: 'Thieu params bat buoc: ' + missing.join(', ') };

      try {
        const organizationId = params.organization_id || await resolveOrganizationId(profile, logger);
        const body = {
          name: params.name,
          organization_id: organizationId,
          db_pass: dbPass,
          region: params.region || getDefaultRegion(profile),
          plan: params.plan || 'free',
        };

        const data = await apiCall('POST', '/projects', token, body, logger, 'createProject');
        return {
          success: true,
          data,
          message: "Da tao project '" + (data.name || params.name) + "' (ref: " + (data.id || '?') + ')',
        };
      } catch (err) {
        return { success: false, data: null, message: err.message };
      }
    },
  },

  getProjectApiKeys: {
    description: 'Lay API keys cua mot project',
    params: [{ name: 'project_ref', required: true, description: 'Reference ID cua project' }],
    async execute(profile, params, logger) {
      const token = getAccessToken(profile);
      if (!token) return { success: false, data: null, message: 'Thieu credentials.accessToken trong profile' };
      if (!params.project_ref) return { success: false, data: null, message: 'Thieu param: project_ref' };

      try {
        const data = await apiCall('GET', '/projects/' + params.project_ref + '/api-keys', token, null, logger, 'getProjectApiKeys');
        const keyCount = Array.isArray(data) ? data.length : '?';
        return { success: true, data, message: 'Lay duoc ' + keyCount + ' API key(s) cho project ' + params.project_ref };
      } catch (err) {
        return { success: false, data: null, message: err.message };
      }
    },
  },

  pauseProject: {
    description: 'Tam dung (pause) mot project Supabase',
    params: [{ name: 'project_ref', required: true, description: 'Reference ID cua project' }],
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
    params: [{ name: 'project_ref', required: true, description: 'Reference ID cua project' }],
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
    params: [{ name: 'project_ref', required: true, description: 'Reference ID cua project' }],
    async execute(profile, params, logger) {
      const token = getAccessToken(profile);
      if (!token) return { success: false, data: null, message: 'Thieu credentials.accessToken trong profile' };
      if (!params.project_ref) return { success: false, data: null, message: 'Thieu param: project_ref' };

      try {
        const data = await apiCallWithFallback(
          'GET',
          ['/projects/' + params.project_ref + '/storage/buckets', '/projects/' + params.project_ref + '/buckets'],
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
          ['/projects/' + params.project_ref + '/storage/buckets', '/projects/' + params.project_ref + '/buckets'],
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

  verifyStorageBucketRW: {
    description: 'Kiem thu bucket bang cach tao file probe roi xoa',
    params: [
      { name: 'project_ref', required: true, description: 'Reference ID cua project' },
      { name: 'bucket_name', required: true, description: 'Ten bucket can verify' },
    ],
    async execute(profile, params, logger) {
      const token = getAccessToken(profile);
      if (!token) return { success: false, data: null, message: 'Thieu credentials.accessToken trong profile' };
      if (!params.project_ref || !params.bucket_name) {
        return { success: false, data: null, message: 'Thieu param: project_ref hoac bucket_name' };
      }

      try {
        const data = await verifyBucketRoundTrip(params.project_ref, params.bucket_name, token, logger);
        return {
          success: true,
          data,
          message: 'Kiem thu bucket thanh cong cho project ' + params.project_ref + ', bucket ' + params.bucket_name,
        };
      } catch (err) {
        return { success: false, data: null, message: err.message };
      }
    },
  },

  getPostgresConnection: {
    description: 'Lay thong tin ket noi Postgres cua project',
    params: [{ name: 'project_ref', required: true, description: 'Reference ID cua project' }],
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
    params: [{ name: 'project_ref', required: true, description: 'Reference ID cua project' }],
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
        s3: buildS3Descriptor(projectRef),
      };

      try {
        out.postgres = await apiCallWithFallback(
          'GET',
          ['/projects/' + projectRef + '/database', '/projects/' + projectRef + '/database/postgres', '/projects/' + projectRef + '/database/connection'],
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
          ['/projects/' + projectRef + '/storage/buckets', '/projects/' + projectRef + '/buckets'],
          token,
          null,
          logger,
          'getProjectConnectionBundle/buckets'
        );
      } catch (_) {}

      persistConnectionBundle(profile, out);

      return {
        success: true,
        data: out,
        message: 'Da tong hop thong tin ket noi cho project ' + projectRef + ' va luu vao config',
      };
    },
  },

  createProjectWithSetup: {
    description: 'Tao project + setup bucket + luu bundle ket noi co ban',
    params: [
      { name: 'name', required: true, description: 'Ten project' },
      { name: 'organization_id', required: false, description: 'Organization ID (tu dong resolve neu de trong)' },
      { name: 'db_pass', required: false, description: 'Mat khau DB (fallback tu profile.meta.project_pass/default_db_pass)' },
      { name: 'bucket_name', required: false, description: 'Ten bucket can tao sau khi tao project' },
      { name: 'region', required: false, description: 'Region (mac dinh theo region_selection.code)' },
      { name: 'plan', required: false, description: 'Plan: free | pro' },
      { name: 'verify_bucket', required: false, description: 'true/false, mac dinh false' },
    ],
    async execute(profile, params, logger) {
      const token = getAccessToken(profile);
      if (!token) return { success: false, data: null, message: 'Thieu credentials.accessToken trong profile' };

      const dbPass = params.db_pass || getDefaultDbPass(profile);
      const missing = [];
      if (!params.name) missing.push('name');
      if (!dbPass) missing.push('db_pass (hoac meta.project_pass/default_db_pass)');
      if (missing.length > 0) return { success: false, data: null, message: 'Thieu params bat buoc: ' + missing.join(', ') };

      try {
        const organizationId = params.organization_id || await resolveOrganizationId(profile, logger);

        const created = await apiCall(
          'POST',
          '/projects',
          token,
          {
            name: params.name,
            organization_id: organizationId,
            db_pass: dbPass,
            region: params.region || getDefaultRegion(profile),
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
          buckets: null,
          bucket: null,
          bucket_verification: null,
          s3: projectRef ? buildS3Descriptor(projectRef) : null,
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

            const shouldVerify = String(params.verify_bucket || 'false').toLowerCase() === 'true';
            if (shouldVerify) {
              result.bucket_verification = await verifyBucketRoundTrip(projectRef, params.bucket_name, token, logger);
            }
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

          try {
            result.buckets = await apiCallWithFallback(
              'GET',
              ['/projects/' + projectRef + '/storage/buckets', '/projects/' + projectRef + '/buckets'],
              token,
              null,
              logger,
              'createProjectWithSetup/listBuckets'
            );
          } catch (_) {}

          persistConnectionBundle(profile, {
            project_ref: projectRef,
            project: created,
            postgres: result.postgres,
            api_keys: result.api_keys,
            buckets: result.buckets,
            s3: result.s3,
          });
        }

        return { success: true, data: result, message: "Da tao project '" + params.name + "' va luu thong tin ket noi vao config" };
      } catch (err) {
        return { success: false, data: null, message: err.message };
      }
    },
  },
};

module.exports = {
  name: 'supabase',
  displayName: 'Supabase',
  version: '1.1.0',
  apiBaseUrl: API_BASE,
  configSchema: {
    required: ['credentials.accessToken'],
    optional: [
      'meta.organization_id',
      'meta.organizations',
      'meta.project_pass',
      'meta.default_db_pass',
      'meta.region_selection',
      'cache.last_connection_bundle',
    ],
  },
  actions,
};
