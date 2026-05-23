import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Menu from '@mui/material/Menu';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import AddIcon from '@mui/icons-material/Add';
import BuildIcon from '@mui/icons-material/Build';
import LockIcon from '@mui/icons-material/Lock';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import StorefrontIcon from '@mui/icons-material/Storefront';
import { useAppDispatch, useAppSelector } from '@/shared/hooks';
import {
  fetchTools,
  fetchBuiltinTools,
  fetchBuiltinPermissions,
  updateBuiltinPermissions,
  createTool,
  updateTool,
  deleteTool,
  startOAuth,
  fetchToolStatus,
  discoverTools,
  startDeviceCodeLogin,
  pollDeviceCodeStatus,
  disconnectM365,
  ToolDefinition,
  BuiltinTool,
} from '@/shared/state/toolsSlice';
import {
  searchRegistry,
  fetchRegistryStats,
  fetchServerDetail,
  clearDetail,
  McpServer,
} from '@/shared/state/mcpRegistrySlice';
import { Skeleton } from '@/app/components/Loading';

import { useClaudeTokens } from '@/shared/styles/ThemeContext';
import { API_BASE } from '@/shared/config';
import { Integration, INTEGRATIONS } from './integrations';
import { CATEGORY_ORDER, ToolForm, emptyForm, serverToToolForm, serverToMcpConfig } from './toolsHelpers';
import ToolSection from './ToolSection';
import BrowserPermissionCard from './BrowserPermissionCard';
import RegistryBrowserDialog from './RegistryBrowserDialog';
import ToolDialogs from './ToolDialogs';
import CustomToolCard from './CustomToolCard';
import IntegrationGalleryCard from './IntegrationGalleryCard';

const Tools: React.FC = () => {
  const c = useClaudeTokens();
  const dispatch = useAppDispatch();
  const { items, builtinTools, builtinPermissions, loading } = useAppSelector((s) => s.tools);
  const { servers: regServersRaw, total: regTotal, loading: regLoading, stats: regStats, detail: regDetail, detailLoading: regDetailLoading } = useAppSelector((s) => s.mcpRegistry);
  const devMode = useAppSelector((s) => s.settings.data.dev_mode);
  const allTools = Object.values(items);
  const tools = allTools;
  const uninstalledIntegrations = useMemo(() => INTEGRATIONS.filter((ig) => !allTools.find((t) => t.name === ig.name)), [allTools]);
  const getIntegrationForTool = useCallback((tool: ToolDefinition) => INTEGRATIONS.find((ig) => ig.name === tool.name), []);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ToolForm>(emptyForm);

  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>(
    Object.fromEntries([
      ...CATEGORY_ORDER.map((cat) => [cat, true]),
      ...CATEGORY_ORDER.map((cat) => [`d_${cat}`, true]),
    ]),
  );
  const [expandedBuiltin, setExpandedBuiltin] = useState<string | null>(null);
  const [coreSectionOpen, setCoreSectionOpen] = useState(false);
  const [deferredSectionOpen, setDeferredSectionOpen] = useState(false);
  const [customSectionOpen, setCustomSectionOpen] = useState(true);

  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const [registryOpen, setRegistryOpen] = useState(false);
  const [regQuery, setRegQuery] = useState('');
  const [regSort, setRegSort] = useState<'name' | 'stars'>('stars');
  // Default 'curated' hides the long tail; client-side filter, backend still returns the full list.
  const [regSource, setRegSource] = useState<'' | 'community' | 'google' | 'curated'>('curated');

  // Curated whitelist matches the MCPSearch alias map in main.py (mcp-meta).
  const CURATED_MCP_NAMES = useMemo(() => new Set([
    'google-workspace', 'microsoft-365', 'slack', 'discord',
    'notion', 'airtable', 'hubspot', 'reddit', 'youtube',
  ]), []);
  const regServers = useMemo(() => {
    if (regSource !== 'curated') return regServersRaw;
    return regServersRaw.filter((srv: any) => {
      const id = (srv?.name || srv?.id || '').toLowerCase();
      return CURATED_MCP_NAMES.has(id);
    });
  }, [regServersRaw, regSource, CURATED_MCP_NAMES]);
  const [expandedServer, setExpandedServer] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity?: 'success' | 'error' }>({ open: false, message: '' });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [mcpConfigOpen, setMcpConfigOpen] = useState(false);
  const [mcpConfigServer, setMcpConfigServer] = useState<McpServer | null>(null);
  const [mcpAuthType, setMcpAuthType] = useState<'none' | 'env_vars'>('none');
  const [mcpCredentials, setMcpCredentials] = useState<Record<string, string>>({});
  const [mcpConfigJson, setMcpConfigJson] = useState('');
  const [mcpConfigError, setMcpConfigError] = useState('');

  const [expandedToolId, setExpandedToolId] = useState<string | null>(null);
  const [discovering, setDiscovering] = useState(false);

  const [integrationLoading, setIntegrationLoading] = useState<Record<string, boolean>>({});

  const [deviceCodeDialogOpen, setDeviceCodeDialogOpen] = useState(false);
  const [deviceCodeDialogToolId, setDeviceCodeDialogToolId] = useState<string | null>(null);
  const [deviceCode, setDeviceCode] = useState('');
  const [deviceCodeUrl, setDeviceCodeUrl] = useState('');
  const [deviceCodeStatus, setDeviceCodeStatus] = useState<'loading' | 'awaiting' | 'connected' | 'error'>('loading');

  const [credDialogOpen, setCredDialogOpen] = useState(false);
  const [credDialogToolId, setCredDialogToolId] = useState<string | null>(null);
  const [credDialogIntegration, setCredDialogIntegration] = useState<Integration | null>(null);
  const [credDialogValues, setCredDialogValues] = useState<Record<string, string>>({});
  const [credDialogSaving, setCredDialogSaving] = useState(false);

  const getInstalledIntegration = useCallback((integration: Integration): ToolDefinition | undefined => {
    return allTools.find((t) => t.name === integration.name);
  }, [allTools]);

  const handleIntegrationToggle = async (integration: Integration) => {
    const existing = getInstalledIntegration(integration);
    setIntegrationLoading((p) => ({ ...p, [integration.id]: true }));
    try {
      if (existing && existing.enabled !== false) {
        await dispatch(updateTool({ id: existing.id, enabled: false }));
        setSnackbar({ open: true, message: `Disabled ${integration.name}` });
      } else if (existing && existing.enabled === false) {
        await dispatch(updateTool({ id: existing.id, enabled: true }));
        if (integration.authType === 'oauth2' && existing.auth_status !== 'connected') {
          setSnackbar({ open: true, message: `Enabled ${integration.name}, connect your account to discover actions` });
        } else {
          setSnackbar({ open: true, message: `Enabled ${integration.name}, re-discovering actions…` });
          const discoverResult = await dispatch(discoverTools(existing.id));
          if (discoverTools.fulfilled.match(discoverResult)) {
            setSnackbar({ open: true, message: `${integration.name} ready, actions discovered` });
          } else {
            const detail = (discoverResult as any).error?.message || 'discovery failed';
            setSnackbar({ open: true, message: `${integration.name}: ${detail}`, severity: 'error' });
          }
        }
      } else {
        const result = await dispatch(createTool({
          name: integration.name,
          description: integration.description,
          command: '',
          mcp_config: integration.mcp_config,
          credentials: {},
          auth_type: integration.authType || 'none',
          auth_status: 'configured',
        }));
        if (createTool.fulfilled.match(result)) {
          const newTool = result.payload;
          if (integration.authType === 'oauth2' || integration.authType === 'device_code') {
            setSnackbar({ open: true, message: `Enabled ${integration.name}, connect your account to discover actions` });
          } else {
            setSnackbar({ open: true, message: `Enabled ${integration.name}, discovering actions…` });
            const discoverResult = await dispatch(discoverTools(newTool.id));
            if (discoverTools.fulfilled.match(discoverResult)) {
              setSnackbar({ open: true, message: `${integration.name} ready, actions discovered` });
            } else {
              const detail = (discoverResult as any).error?.message
                || `discovery failed; is ${integration.mcp_config.command || 'the server'} installed?`;
              setSnackbar({ open: true, message: `${integration.name}: ${detail}`, severity: 'error' });
            }
          }
        }
      }
    } finally {
      setIntegrationLoading((p) => ({ ...p, [integration.id]: false }));
    }
  };

  const handleDiscover = async (toolId: string) => {
    setDiscovering(true);
    try {
      const result = await dispatch(discoverTools(toolId));
      if (discoverTools.fulfilled.match(result)) {
        setSnackbar({ open: true, message: 'Actions discovered successfully' });
      } else {
        const detail = (result as any).error?.message || 'Discovery failed; is the MCP server running?';
        setSnackbar({ open: true, message: detail, severity: 'error' });
      }
    } finally {
      setDiscovering(false);
    }
  };

  const handlePermissionChange = async (toolId: string, toolName: string, policy: string) => {
    const tool = items[toolId];
    if (!tool) return;
    const updated = { ...tool.tool_permissions, [toolName]: policy };
    await dispatch(updateTool({ id: toolId, tool_permissions: updated }));
  };

  const handleGroupPermissionChange = async (toolId: string, names: string[], policy: string) => {
    const tool = items[toolId];
    if (!tool) return;
    const updated = { ...tool.tool_permissions };
    for (const name of names) updated[name] = policy;
    await dispatch(updateTool({ id: toolId, tool_permissions: updated }));
  };

  const handleBulkReadOnly = async (toolId: string) => {
    const tool = items[toolId];
    if (!tool?.tool_permissions?._categories) return;
    const readNames: string[] = tool.tool_permissions._categories.read || [];
    const updated = { ...tool.tool_permissions };
    for (const name of readNames) updated[name] = 'always_allow';
    await dispatch(updateTool({ id: toolId, tool_permissions: updated }));
  };

  const handleResetPermissions = async (toolId: string) => {
    const tool = items[toolId];
    if (!tool?.tool_permissions) return;
    const updated = { ...tool.tool_permissions };
    for (const key of Object.keys(updated)) {
      if (!key.startsWith('_')) updated[key] = 'ask';
    }
    await dispatch(updateTool({ id: toolId, tool_permissions: updated }));
  };

  const [expandedServices, setExpandedServices] = useState<Record<string, boolean>>({});
  const [expandedSchema, setExpandedSchema] = useState<string | null>(null);

  const [browserSectionOpen, setBrowserSectionOpen] = useState(false);
  const [browserCollapsed, setBrowserCollapsed] = useState<Record<string, boolean>>({ browser_delegation: true, browser_action: true });
  const [builtinSectionOpen, setBuiltinSectionOpen] = useState(true);

  useEffect(() => {
    dispatch(fetchTools());
    dispatch(fetchBuiltinTools());
    dispatch(fetchBuiltinPermissions());
  }, [dispatch]);

  const handleBuiltinPermissionChange = async (toolName: string, policy: string) => {
    await dispatch(updateBuiltinPermissions({ [toolName]: policy }));
  };

  const handleBuiltinCategoryPermissionChange = async (toolNames: string[], policy: string) => {
    const perms: Record<string, string> = {};
    for (const name of toolNames) perms[name] = policy;
    await dispatch(updateBuiltinPermissions(perms));
  };

  const BROWSER_CATEGORIES = new Set(['browser_delegation', 'browser_action']);
  const coreTools = useMemo(() => builtinTools.filter((bt) => !bt.deferred && !BROWSER_CATEGORIES.has(bt.category)), [builtinTools]);
  const deferredTools = useMemo(() => builtinTools.filter((bt) => bt.deferred && !BROWSER_CATEGORIES.has(bt.category)), [builtinTools]);
  const browserTools = useMemo(() => builtinTools.filter((bt) => BROWSER_CATEGORIES.has(bt.category)), [builtinTools]);
  const browserDelegationTools = useMemo(() => browserTools.filter((bt) => bt.category === 'browser_delegation'), [browserTools]);
  const browserActionTools = useMemo(() => browserTools.filter((bt) => bt.category === 'browser_action'), [browserTools]);
  const groupTools = (list: BuiltinTool[]) => {
    const g: Record<string, BuiltinTool[]> = {};
    for (const bt of list) { if (!g[bt.category]) g[bt.category] = []; g[bt.category].push(bt); }
    return g;
  };
  const groupedCore = useMemo(() => groupTools(coreTools), [coreTools]);
  const groupedDeferred = useMemo(() => groupTools(deferredTools), [deferredTools]);

  const coreSectionEnabled = useMemo(
    () => !coreTools.every((t) => builtinPermissions[t.name] === 'deny'),
    [coreTools, builtinPermissions],
  );
  const deferredSectionEnabled = useMemo(
    () => !deferredTools.every((t) => builtinPermissions[t.name] === 'deny'),
    [deferredTools, builtinPermissions],
  );
  const browserSectionEnabled = useMemo(
    () => browserTools.length > 0 && !browserTools.every((t) => builtinPermissions[t.name] === 'deny'),
    [browserTools, builtinPermissions],
  );

  const handleSectionEnabledChange = async (tools: BuiltinTool[], enabled: boolean) => {
    const perms: Record<string, string> = {};
    for (const t of tools) perms[t.name] = enabled ? 'always_allow' : 'deny';
    await dispatch(updateBuiltinPermissions(perms));
  };

  const toggleCategory = (cat: string) => setCollapsedCategories((p) => ({ ...p, [cat]: !p[cat] }));
  const toggleBuiltinExpand = (name: string) => setExpandedBuiltin((p) => (p === name ? null : name));

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>) => setMenuAnchor(e.currentTarget);
  const handleMenuClose = () => setMenuAnchor(null);

  const openCreate = () => {
    handleMenuClose();
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openRegistryBrowser = () => {
    handleMenuClose();
    setRegistryOpen(true);
    setRegQuery('');
    setRegSort('stars');
    setRegSource('');
    setExpandedServer(null);
    dispatch(fetchRegistryStats());
    dispatch(searchRegistry({ q: '', limit: 20, offset: 0, sort: 'stars', source: '' }));
  };

  const openEdit = (tool: ToolDefinition) => {
    setEditingId(tool.id);
    setForm({ name: tool.name, description: tool.description, command: tool.command });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload = { name: form.name, description: form.description, command: form.command };
    if (editingId) { await dispatch(updateTool({ id: editingId, ...payload })); } else { await dispatch(createTool(payload)); }
    setDialogOpen(false);
  };

  const handleDelete = async (id: string) => { await dispatch(deleteTool(id)); };

  // Translate UI "curated" pseudo-source to "" for the backend; the whitelist is applied client-side.
  const _backendSource = (s: '' | 'community' | 'google' | 'curated'): '' | 'community' | 'google' =>
    s === 'curated' ? '' : s;

  const handleRegSearch = useCallback((q: string, sort?: 'name' | 'stars', source?: '' | 'community' | 'google' | 'curated') => {
    setRegQuery(q);
    setExpandedServer(null);
    const sortVal = sort ?? regSort;
    const sourceVal = source ?? regSource;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      dispatch(searchRegistry({ q, limit: 20, offset: 0, sort: sortVal, source: _backendSource(sourceVal) }));
    }, 300);
  }, [dispatch, regSort, regSource]);

  const handleLoadMore = () => {
    dispatch(searchRegistry({ q: regQuery, limit: 20, offset: regServersRaw.length, sort: regSort, source: _backendSource(regSource) }));
  };

  const handleRegSort = (sort: 'name' | 'stars') => {
    setRegSort(sort);
    setExpandedServer(null);
    dispatch(searchRegistry({ q: regQuery, limit: 20, offset: 0, sort, source: _backendSource(regSource) }));
  };

  const handleRegSourceFilter = (_: React.MouseEvent<HTMLElement>, val: '' | 'community' | 'google' | 'curated') => {
    if (val === null) return;
    setRegSource(val);
    setExpandedServer(null);
    dispatch(searchRegistry({ q: regQuery, limit: 20, offset: 0, sort: regSort, source: _backendSource(val) }));
  };

  const openMcpConfigDialog = (srv: McpServer) => {
    setMcpConfigServer(srv);
    setMcpAuthType('none');
    setMcpCredentials({});
    const derivedConfig = serverToMcpConfig(srv);
    setMcpConfigJson(JSON.stringify(
      Object.keys(derivedConfig).length > 0 ? derivedConfig : {},
      null, 2,
    ));
    setMcpConfigError('');
    setMcpConfigOpen(true);
  };

  const handleMcpConfigSave = async () => {
    if (!mcpConfigServer) return;
    let parsedConfig: Record<string, any> = {};
    try { parsedConfig = JSON.parse(mcpConfigJson); } catch { setMcpConfigError('Invalid JSON'); return; }

    const f = serverToToolForm(mcpConfigServer);
    const authStatus = 'configured';

    await dispatch(createTool({
      name: f.name,
      description: f.description,
      command: '',
      mcp_config: parsedConfig,
      credentials: mcpCredentials,
      auth_type: mcpAuthType,
      auth_status: authStatus,
    }));

    setMcpConfigOpen(false);
    setSnackbar({ open: true, message: `Installed "${f.name}" as MCP tool` });
  };

  const handleInstall = async (srv: McpServer) => {
    const f = serverToToolForm(srv);
    const mcpConfig = serverToMcpConfig(srv);
    const hasConfig = Object.keys(mcpConfig).length > 0;

    if (srv.source === 'google' && srv.remoteUrl && hasConfig) {
      await dispatch(createTool({
        name: f.name,
        description: f.description,
        command: '',
        mcp_config: mcpConfig,
        credentials: {},
        auth_type: 'oauth2',
        auth_status: 'configured',
      }));
      setSnackbar({ open: true, message: `Installed "${f.name}", click "Connect Google" to authorize` });
    } else if (hasConfig && mcpConfig.type === 'stdio') {
      const result = await dispatch(createTool({
        name: f.name,
        description: f.description,
        command: '',
        mcp_config: mcpConfig,
        credentials: {},
        auth_type: 'none',
        auth_status: 'configured',
      }));
      if (createTool.fulfilled.match(result)) {
        const newTool = result.payload;
        setSnackbar({ open: true, message: `Installed "${f.name}", discovering actions…` });
        const discoverResult = await dispatch(discoverTools(newTool.id));
        if (discoverTools.fulfilled.match(discoverResult)) {
          setSnackbar({ open: true, message: `${f.name} ready, actions discovered` });
        } else {
          const detail = (discoverResult as any).error?.message
            || 'discovery failed; the MCP server may need setup first';
          setSnackbar({ open: true, message: `${f.name}: ${detail}`, severity: 'error' });
        }
      }
    } else {
      openMcpConfigDialog(srv);
    }
  };

  const handleEditInstall = (srv: McpServer) => {
    setRegistryOpen(false);
    const f = serverToToolForm(srv);
    setEditingId(null);
    setForm(f);
    setDialogOpen(true);
  };

  const handleOAuthConnect = async (toolId: string) => {
    const result = await dispatch(startOAuth(toolId));
    if (startOAuth.fulfilled.match(result)) {
      const { auth_url } = result.payload;
      const popup = window.open(auth_url, 'oauth', 'width=500,height=700,left=200,top=100');

      const afterConnect = async () => {
        const statusResult = await dispatch(fetchToolStatus(toolId));
        if (fetchToolStatus.fulfilled.match(statusResult) && statusResult.payload.auth_status === 'connected') {
          setSnackbar({ open: true, message: 'Account connected! Discovering actions…' });
          setExpandedToolId(toolId);
          dispatch(discoverTools(toolId));
        } else {
          setSnackbar({ open: true, message: 'Account connected!' });
        }
      };

      const onMessage = (event: MessageEvent) => {
        if (event.data?.type === 'oauth_complete' && event.data?.tool_id === toolId) {
          afterConnect();
          window.removeEventListener('message', onMessage);
        }
      };
      window.addEventListener('message', onMessage);

      const pollInterval = setInterval(() => {
        if (popup?.closed) {
          clearInterval(pollInterval);
          afterConnect();
          window.removeEventListener('message', onMessage);
        }
      }, 1000);
    } else {
      setSnackbar({ open: true, message: 'OAuth failed; check that OAuth credentials are set in backend .env', severity: 'error' });
    }
  };

  const handleDeviceCodeConnect = async (toolId: string) => {
    setDeviceCodeDialogToolId(toolId);
    setDeviceCodeStatus('loading');
    setDeviceCode('');
    setDeviceCodeUrl('');
    setDeviceCodeDialogOpen(true);

    const result = await dispatch(startDeviceCodeLogin(toolId));
    if (startDeviceCodeLogin.fulfilled.match(result)) {
      const { device_code, device_code_url } = result.payload;
      setDeviceCode(device_code);
      const url = device_code_url || 'https://login.microsoft.com/device';
      setDeviceCodeUrl(url);
      setDeviceCodeStatus('awaiting');

      window.open(url, 'm365-login', 'width=500,height=700,left=200,top=100');

      const poll = setInterval(async () => {
        const statusResult = await dispatch(pollDeviceCodeStatus(toolId));
        if (pollDeviceCodeStatus.fulfilled.match(statusResult)) {
          const { status, email } = statusResult.payload;
          if (status === 'connected') {
            clearInterval(poll);
            setDeviceCodeStatus('connected');
            setSnackbar({ open: true, message: `Connected to Microsoft 365${email ? ` as ${email}` : ''}! Discovering actions…` });
            setDeviceCodeDialogOpen(false);
            setExpandedToolId(toolId);
            await dispatch(fetchToolStatus(toolId));
            dispatch(discoverTools(toolId));
          } else if (status === 'error') {
            clearInterval(poll);
            setDeviceCodeStatus('error');
          }
        }
      }, 2000);

      setTimeout(() => clearInterval(poll), 300000);
    } else {
      setDeviceCodeStatus('error');
    }
  };

  const handleM365Disconnect = async (toolId: string) => {
    await dispatch(disconnectM365(toolId));
    setSnackbar({ open: true, message: 'Disconnected from Microsoft 365' });
  };

  const openCredentialsDialog = (toolId: string, integration: Integration) => {
    const tool = items[toolId];
    const existing = tool?.credentials || {};
    const initial: Record<string, string> = {};
    for (const field of integration.credentialFields || []) {
      initial[field.key] = existing[field.key] || '';
    }
    setCredDialogToolId(toolId);
    setCredDialogIntegration(integration);
    setCredDialogValues(initial);
    setCredDialogOpen(true);
  };

  const handleCredentialsSave = async () => {
    if (!credDialogToolId || !credDialogIntegration) return;
    const hasEmpty = (credDialogIntegration.credentialFields || []).some((f) => !credDialogValues[f.key]?.trim());
    if (hasEmpty) return;

    setCredDialogSaving(true);
    try {
      const result = await dispatch(updateTool({
        id: credDialogToolId,
        credentials: credDialogValues,
        auth_type: 'env_vars',
        auth_status: 'connected',
      }));
      if (updateTool.fulfilled.match(result)) {
        setCredDialogOpen(false);
        setSnackbar({ open: true, message: `${credDialogIntegration.name} connected! Re-discovering actions…` });
        dispatch(discoverTools(credDialogToolId));
      } else {
        setSnackbar({ open: true, message: 'Failed to save credentials', severity: 'error' });
      }
    } finally {
      setCredDialogSaving(false);
    }
  };

  const handleSlackAutoConnect = async () => {
    if (!credDialogToolId || !credDialogIntegration) return;
    const slackBridge = (window as any).openswarm?.connectSlack;
    if (!slackBridge) {
      setSnackbar({ open: true, message: 'Slack auto-connect requires the desktop app', severity: 'error' });
      return;
    }
    setCredDialogSaving(true);
    try {
      const { token, cookie } = await slackBridge();
      const creds = { SLACK_MCP_XOXC_TOKEN: token, SLACK_MCP_XOXD_TOKEN: cookie };
      const result = await dispatch(updateTool({
        id: credDialogToolId,
        credentials: creds,
        auth_type: 'env_vars',
        auth_status: 'connected',
      }));
      if (updateTool.fulfilled.match(result)) {
        setCredDialogOpen(false);
        setSnackbar({ open: true, message: 'Slack connected! Re-discovering actions…' });
        dispatch(discoverTools(credDialogToolId));
      } else {
        setSnackbar({ open: true, message: 'Failed to save Slack credentials', severity: 'error' });
      }
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'Slack sign-in cancelled', severity: 'error' });
    } finally {
      setCredDialogSaving(false);
    }
  };

  const handleDisconnectIntegration = async (toolId: string, integration: Integration) => {
    if (integration.authType === 'oauth2') {
      fetch(`${API_BASE}/tools/${toolId}/oauth/disconnect`, { method: 'POST' }).catch(() => {});
      const result = await dispatch(updateTool({
        id: toolId,
        oauth_tokens: {},
        auth_status: 'configured',
        connected_account_email: '',
      }));
      if (updateTool.fulfilled.match(result)) {
        setSnackbar({ open: true, message: `${integration.name} disconnected. You can now connect a different account.` });
      } else {
        setSnackbar({ open: true, message: `Failed to disconnect ${integration.name}`, severity: 'error' });
      }
    } else {
      await dispatch(updateTool({
        id: toolId,
        credentials: {},
        auth_type: 'none',
        auth_status: 'configured',
      }));
      setSnackbar({ open: true, message: `${integration.name} disconnected` });
    }
  };

  return (
    <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ color: c.text.primary, fontWeight: 700, mb: 0.5 }}>Action Library</Typography>
          <Typography sx={{ color: c.text.tertiary, fontSize: '0.9rem' }}>Define and manage custom actions for your Claude Code agents.</Typography>
        </Box>
        <Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            endIcon={<KeyboardArrowDownIcon sx={{ fontSize: 18 }} />}
            onClick={handleMenuOpen}
            sx={{ bgcolor: c.accent.primary, '&:hover': { bgcolor: c.accent.pressed }, textTransform: 'none', borderRadius: 2 }}
          >
            New Action
          </Button>
          <Menu
            anchorEl={menuAnchor}
            open={!!menuAnchor}
            onClose={handleMenuClose}
            PaperProps={{ sx: { bgcolor: c.bg.surface, border: `1px solid ${c.border.subtle}`, borderRadius: 2, mt: 0.5, minWidth: 200 } }}
          >
            <MenuItem onClick={openCreate} sx={{ color: c.text.primary, fontSize: '0.88rem', gap: 1.5, '&:hover': { bgcolor: c.bg.secondary } }}>
              <BuildIcon sx={{ fontSize: 16, color: c.text.tertiary }} />
              Create Custom
            </MenuItem>
            <MenuItem onClick={openRegistryBrowser} sx={{ color: c.text.primary, fontSize: '0.88rem', gap: 1.5, '&:hover': { bgcolor: c.bg.secondary } }}>
              <StorefrontIcon sx={{ fontSize: 16, color: c.text.tertiary }} />
              Browse MCP Registry
            </MenuItem>
          </Menu>
        </Box>
      </Box>

      <Box sx={{ mb: 3 }}>
        <Box
          onClick={() => setBuiltinSectionOpen((v) => !v)}
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, cursor: 'pointer', userSelect: 'none', '&:hover .section-arrow': { color: c.text.secondary } }}
        >
          {builtinSectionOpen ? <KeyboardArrowDownIcon className="section-arrow" sx={{ fontSize: 18, color: c.text.tertiary, transition: 'color 0.15s' }} /> : <KeyboardArrowRightIcon className="section-arrow" sx={{ fontSize: 18, color: c.text.tertiary, transition: 'color 0.15s' }} />}
          <LockIcon sx={{ fontSize: 14, color: c.text.tertiary }} />
          <Typography sx={{ color: c.text.muted, fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Built-in Action Sets</Typography>
          <Chip label={coreTools.length + deferredTools.length + browserTools.length} size="small" sx={{ bgcolor: c.bg.secondary, color: c.text.muted, fontSize: '0.7rem', height: 18, minWidth: 24, '& .MuiChip-label': { px: 0.8 } }} />
        </Box>
        <Collapse in={builtinSectionOpen} timeout={0} unmountOnExit>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pl: 1 }}>

      {coreTools.length > 0 && (
        <ToolSection label="Core Actions" icon={<LockIcon sx={{ fontSize: 14, color: c.text.tertiary }} />} count={coreTools.length} open={coreSectionOpen} onToggle={() => setCoreSectionOpen((v) => !v)} grouped={groupedCore} collapsedCategories={collapsedCategories} toggleCategory={toggleCategory} expandedBuiltin={expandedBuiltin} toggleBuiltinExpand={toggleBuiltinExpand} builtinPermissions={builtinPermissions} onPermissionChange={handleBuiltinPermissionChange} onCategoryPermissionChange={handleBuiltinCategoryPermissionChange} enabled={coreSectionEnabled} onEnabledChange={(v) => handleSectionEnabledChange(coreTools, v)} />
      )}

      {deferredTools.length > 0 && (
        <ToolSection label="Extended Actions" icon={<HourglassEmptyIcon sx={{ fontSize: 14, color: c.text.tertiary }} />} count={deferredTools.length} open={deferredSectionOpen} onToggle={() => setDeferredSectionOpen((v) => !v)} grouped={groupedDeferred} collapsedCategories={collapsedCategories} toggleCategory={toggleCategory} expandedBuiltin={expandedBuiltin} toggleBuiltinExpand={toggleBuiltinExpand} deferred builtinPermissions={builtinPermissions} onPermissionChange={handleBuiltinPermissionChange} onCategoryPermissionChange={handleBuiltinCategoryPermissionChange} enabled={deferredSectionEnabled} onEnabledChange={(v) => handleSectionEnabledChange(deferredTools, v)} />
      )}

      {browserTools.length > 0 && (
        <BrowserPermissionCard
          open={browserSectionOpen}
          enabled={browserSectionEnabled}
          onToggleOpen={() => setBrowserSectionOpen((v) => !v)}
          browserTools={browserTools}
          browserDelegationTools={browserDelegationTools}
          browserActionTools={browserActionTools}
          browserCollapsed={browserCollapsed}
          setBrowserCollapsed={setBrowserCollapsed}
          builtinPermissions={builtinPermissions}
          onSectionEnabledChange={handleSectionEnabledChange}
          onCategoryPermissionChange={handleBuiltinCategoryPermissionChange}
          onPermissionChange={handleBuiltinPermissionChange}
        />
      )}

          </Box>
        </Collapse>
      </Box>

      <Box sx={{ mb: 2 }}>
        <Box onClick={() => setCustomSectionOpen((v) => !v)} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, cursor: 'pointer', userSelect: 'none', '&:hover .section-arrow': { color: c.text.secondary } }}>
          {customSectionOpen ? <KeyboardArrowDownIcon className="section-arrow" sx={{ fontSize: 18, color: c.text.tertiary, transition: 'color 0.15s' }} /> : <KeyboardArrowRightIcon className="section-arrow" sx={{ fontSize: 18, color: c.text.tertiary, transition: 'color 0.15s' }} />}
          <BuildIcon sx={{ fontSize: 14, color: c.text.tertiary }} />
          <Typography sx={{ color: c.text.muted, fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Custom Action Sets</Typography>
          <Chip label={tools.length + uninstalledIntegrations.length} size="small" sx={{ bgcolor: c.bg.secondary, color: c.text.muted, fontSize: '0.7rem', height: 18, minWidth: 24, '& .MuiChip-label': { px: 0.8 } }} />
        </Box>
        <Collapse in={customSectionOpen} timeout={0} unmountOnExit>
          {loading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pl: 1, mt: 1 }}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} variant="card" height={72} />
              ))}
            </Box>
          ) : (tools.length === 0 && uninstalledIntegrations.length === 0) ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 6, color: c.text.ghost, gap: 1.5 }}>
              <BuildIcon sx={{ fontSize: 40, opacity: 0.3 }} />
              <Typography sx={{ fontSize: '0.9rem' }}>No custom actions defined yet. Create one to get started.</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pl: 1 }}>
              {uninstalledIntegrations.map((ig) => (
                <IntegrationGalleryCard
                  key={ig.id}
                  integration={ig}
                  isLoading={!!integrationLoading[ig.id]}
                  onToggle={handleIntegrationToggle}
                />
              ))}
              {tools.map((tool) => (
                <CustomToolCard
                  key={tool.id}
                  tool={tool}
                  ig={getIntegrationForTool(tool)}
                  isExpanded={expandedToolId === tool.id}
                  onToggleExpand={(toolId, wasExpanded) => setExpandedToolId(wasExpanded ? null : toolId)}
                  expandedServices={expandedServices}
                  setExpandedServices={setExpandedServices}
                  expandedSchema={expandedSchema}
                  setExpandedSchema={setExpandedSchema}
                  devMode={devMode}
                  integrationLoading={integrationLoading}
                  discovering={discovering}
                  onPermissionChange={handlePermissionChange}
                  onGroupPermissionChange={handleGroupPermissionChange}
                  onBulkReadOnly={handleBulkReadOnly}
                  onResetPermissions={handleResetPermissions}
                  onDiscover={handleDiscover}
                  onIntegrationToggle={handleIntegrationToggle}
                  onOAuthConnect={handleOAuthConnect}
                  onDeviceCodeConnect={handleDeviceCodeConnect}
                  onM365Disconnect={handleM365Disconnect}
                  onDisconnectIntegration={handleDisconnectIntegration}
                  onOpenCredentialsDialog={openCredentialsDialog}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                />
              ))}
            </Box>
          )}
        </Collapse>
      </Box>

      <ToolDialogs
        dialogOpen={dialogOpen}
        setDialogOpen={setDialogOpen}
        editingId={editingId}
        form={form}
        setForm={setForm}
        onSave={handleSave}
        mcpConfigOpen={mcpConfigOpen}
        setMcpConfigOpen={setMcpConfigOpen}
        mcpConfigServer={mcpConfigServer}
        mcpConfigJson={mcpConfigJson}
        setMcpConfigJson={setMcpConfigJson}
        mcpConfigError={mcpConfigError}
        setMcpConfigError={setMcpConfigError}
        mcpAuthType={mcpAuthType}
        setMcpAuthType={setMcpAuthType}
        mcpCredentials={mcpCredentials}
        setMcpCredentials={setMcpCredentials}
        onMcpConfigSave={handleMcpConfigSave}
        deviceCodeDialogOpen={deviceCodeDialogOpen}
        setDeviceCodeDialogOpen={setDeviceCodeDialogOpen}
        deviceCodeStatus={deviceCodeStatus}
        deviceCodeUrl={deviceCodeUrl}
        deviceCode={deviceCode}
        credDialogOpen={credDialogOpen}
        setCredDialogOpen={setCredDialogOpen}
        credDialogIntegration={credDialogIntegration}
        credDialogValues={credDialogValues}
        setCredDialogValues={setCredDialogValues}
        credDialogSaving={credDialogSaving}
        onSlackAutoConnect={handleSlackAutoConnect}
        onCredentialsSave={handleCredentialsSave}
      />

      <RegistryBrowserDialog
        open={registryOpen}
        onClose={() => setRegistryOpen(false)}
        regStats={regStats}
        regSource={regSource}
        devMode={devMode}
        regQuery={regQuery}
        onRegSearch={handleRegSearch}
        regSort={regSort}
        onRegSort={handleRegSort}
        onRegSourceFilter={handleRegSourceFilter}
        regLoading={regLoading}
        regServers={regServers}
        regTotal={regTotal}
        allTools={allTools}
        expandedServer={expandedServer}
        onExpandServer={(srv, next) => {
          setExpandedServer(next);
          if (next && devMode) {
            dispatch(clearDetail());
            dispatch(fetchServerDetail(srv.name));
          }
        }}
        regDetail={regDetail}
        regDetailLoading={regDetailLoading}
        onInstall={handleInstall}
        onEditInstall={handleEditInstall}
        onLoadMore={handleLoadMore}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ open: false, message: '' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar({ open: false, message: '' })} severity={snackbar.severity || 'success'} sx={{ bgcolor: snackbar.severity === 'error' ? '#2e1a1a' : c.status.successBg, color: snackbar.severity === 'error' ? '#f87171' : c.status.success, border: `1px solid ${snackbar.severity === 'error' ? '#ef444440' : `${c.status.success}40`}` }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Tools;
