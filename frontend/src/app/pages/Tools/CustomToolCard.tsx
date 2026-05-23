import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import Collapse from '@mui/material/Collapse';
import Switch from '@mui/material/Switch';
import IconButton from '@mui/material/IconButton';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import TerminalIcon from '@mui/icons-material/Terminal';
import ExtensionIcon from '@mui/icons-material/Extension';
import SearchIcon from '@mui/icons-material/Search';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import LinkIcon from '@mui/icons-material/Link';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SettingsIcon from '@mui/icons-material/Settings';
import BlockIcon from '@mui/icons-material/Block';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SecurityIcon from '@mui/icons-material/Security';
import PanToolIcon from '@mui/icons-material/PanTool';
import RefreshIcon from '@mui/icons-material/Refresh';
import { ToolDefinition } from '@/shared/state/toolsSlice';
import { useClaudeTokens } from '@/shared/styles/ThemeContext';
import { Integration } from './integrations';

interface CustomToolCardProps {
  tool: ToolDefinition;
  ig: Integration | undefined;
  isExpanded: boolean;
  onToggleExpand: (toolId: string, isExpanded: boolean) => void;
  expandedServices: Record<string, boolean>;
  setExpandedServices: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  expandedSchema: string | null;
  setExpandedSchema: React.Dispatch<React.SetStateAction<string | null>>;
  devMode: boolean;
  integrationLoading: Record<string, boolean>;
  discovering: boolean;
  onPermissionChange: (toolId: string, toolName: string, policy: string) => void;
  onGroupPermissionChange: (toolId: string, names: string[], policy: string) => void;
  onBulkReadOnly: (toolId: string) => void;
  onResetPermissions: (toolId: string) => void;
  onDiscover: (toolId: string) => void;
  onIntegrationToggle: (integration: Integration) => void;
  onOAuthConnect: (toolId: string) => void;
  onDeviceCodeConnect: (toolId: string) => void;
  onM365Disconnect: (toolId: string) => void;
  onDisconnectIntegration: (toolId: string, integration: Integration) => void;
  onOpenCredentialsDialog: (toolId: string, integration: Integration) => void;
  onEdit: (tool: ToolDefinition) => void;
  onDelete: (toolId: string) => void;
}

const CustomToolCard: React.FC<CustomToolCardProps> = ({
  tool, ig, isExpanded, onToggleExpand,
  expandedServices, setExpandedServices, expandedSchema, setExpandedSchema,
  devMode, integrationLoading, discovering,
  onPermissionChange: handlePermissionChange,
  onGroupPermissionChange: handleGroupPermissionChange,
  onBulkReadOnly: handleBulkReadOnly,
  onResetPermissions: handleResetPermissions,
  onDiscover: handleDiscover,
  onIntegrationToggle: handleIntegrationToggle,
  onOAuthConnect: handleOAuthConnect,
  onDeviceCodeConnect: handleDeviceCodeConnect,
  onM365Disconnect: handleM365Disconnect,
  onDisconnectIntegration: handleDisconnectIntegration,
  onOpenCredentialsDialog: openCredentialsDialog,
  onEdit: openEdit,
  onDelete: handleDelete,
}) => {
  const c = useClaudeTokens();

  const isMcp = tool.mcp_config && Object.keys(tool.mcp_config).length > 0;
  const isStdio = isMcp && (tool.mcp_config.type === 'stdio' || !!tool.mcp_config.command);
  const canDiscover = isMcp;
  const perms = tool.tool_permissions || {};
  const services = perms._services as Record<string, { read?: string[]; write?: string[] }> | undefined;
  const descriptions = (perms._tool_descriptions || {}) as Record<string, string>;
  const schemas = (perms._tool_schemas || {}) as Record<string, any>;
  const serviceNames = services ? Object.keys(services) : [];
  const hasPerms = serviceNames.length > 0;
  const totalToolCount = serviceNames.reduce((acc, s) => acc + (services![s].read?.length || 0) + (services![s].write?.length || 0), 0);

  const toDisplayName = (name: string, serviceName?: string) => {
    let display = name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    if (serviceName) {
      const svcLower = serviceName.toLowerCase();
      const variants = [svcLower, svcLower.replace(/s$/, '')];
      for (const v of variants) {
        display = display.replace(new RegExp(`\\b${v}\\b`, 'gi'), '').trim();
      }
      display = display.replace(/\s{2,}/g, ' ').trim();
    }
    return display;
  };

  const firstSentence = (desc: string) => {
    if (!desc) return '';
    const match = desc.match(/^(.+?(?:\.|$))/);
    return match ? match[1].trim() : desc.substring(0, 100);
  };

  const getGroupPolicy = (names: string[]) => {
    if (names.length === 0) return 'ask';
    const policies = names.map((n) => perms[n] || 'ask');
    if (policies.every((p) => p === 'always_allow')) return 'always_allow';
    if (policies.every((p) => p === 'deny')) return 'deny';
    if (policies.every((p) => p === 'ask')) return 'ask';
    return 'mixed';
  };

  const PermToggle = ({ value, onChange, size = 16 }: { value: string; onChange: (v: string) => void; size?: number }) => (
    <Box sx={{ display: 'flex', gap: 0.25 }} onClick={(e) => e.stopPropagation()}>
      <Tooltip title="Always allow"><IconButton size="small" onClick={() => onChange('always_allow')} sx={{ p: 0.4, borderRadius: 1, bgcolor: value === 'always_allow' ? `${c.status.success}20` : 'transparent', color: value === 'always_allow' ? c.status.success : c.text.ghost, '&:hover': { bgcolor: `${c.status.success}15`, color: c.status.success } }}><CheckCircleIcon sx={{ fontSize: size }} /></IconButton></Tooltip>
      <Tooltip title="Ask permission"><IconButton size="small" onClick={() => onChange('ask')} sx={{ p: 0.4, borderRadius: 1, bgcolor: value === 'ask' ? `${c.status.warning}20` : 'transparent', color: value === 'ask' ? c.status.warning : c.text.ghost, '&:hover': { bgcolor: `${c.status.warning}15`, color: c.status.warning } }}><PanToolIcon sx={{ fontSize: size }} /></IconButton></Tooltip>
      <Tooltip title="Always deny"><IconButton size="small" onClick={() => onChange('deny')} sx={{ p: 0.4, borderRadius: 1, bgcolor: value === 'deny' ? `${c.status.error}20` : 'transparent', color: value === 'deny' ? c.status.error : c.text.ghost, '&:hover': { bgcolor: `${c.status.error}15`, color: c.status.error } }}><BlockIcon sx={{ fontSize: size }} /></IconButton></Tooltip>
    </Box>
  );

  const ServiceGroup = ({ serviceName, data, isFirstGroup }: { serviceName: string; data: { read?: string[]; write?: string[] }; isFirstGroup?: boolean }) => {
    const svcKey = `${tool.id}:${serviceName}`;
    const isOpen = expandedServices[svcKey] ?? false;
    const allNames = [...(data.read || []), ...(data.write || [])];
    const svcPolicy = getGroupPolicy(allNames);
    const count = allNames.length;
    const isReddit =
      ig?.id === 'reddit' ||
      tool.name?.toLowerCase() === 'reddit' ||
      (tool.command || '').toLowerCase().includes('reddit');
    const isYoutube =
      ig?.id === 'youtube' ||
      tool.name?.toLowerCase() === 'youtube' ||
      (tool.command || '').toLowerCase().includes('youtube');
    const isSubredditsForReddit =
      isReddit && /subreddit/i.test(serviceName);
    // YouTube marker lands on the first service group since YouTube has no drill-down.
    const showPermissionMarker =
      isSubredditsForReddit || (isYoutube && isFirstGroup);

    return (
      <Box sx={{ border: `1px solid ${c.border.subtle}`, borderRadius: 1.5, overflow: 'hidden', '&:hover': { borderColor: `${c.border.medium}` } }}>
        <Box
          data-onboarding={isSubredditsForReddit ? 'actions-subreddits-chevron' : undefined}
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.5, py: 0.75, cursor: 'pointer', bgcolor: isOpen ? c.bg.secondary : 'transparent', '&:hover': { bgcolor: c.bg.secondary } }}
          onClick={() => setExpandedServices((p) => ({ ...p, [svcKey]: !isOpen }))}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <KeyboardArrowDownIcon sx={{ fontSize: 16, color: c.text.ghost, transition: 'transform 0.15s', transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
            <Typography sx={{ color: c.text.primary, fontSize: '0.85rem', fontWeight: 600 }}>{serviceName}</Typography>
            <Chip label={count} size="small" sx={{ bgcolor: c.bg.page, color: c.text.muted, fontSize: '0.65rem', height: 18, '& .MuiChip-label': { px: 0.6 } }} />
          </Box>
          <Box data-onboarding={showPermissionMarker ? 'actions-permission-toggle' : undefined}>
            <PermToggle value={svcPolicy === 'mixed' ? 'ask' : svcPolicy} onChange={(v) => handleGroupPermissionChange(tool.id, allNames, v)} />
          </Box>
        </Box>
        <Collapse in={isOpen} timeout={0} unmountOnExit>
          <Box sx={{ px: 1, pb: 1 }}>
            {(data.read?.length || 0) > 0 && (
              <Box sx={{ mt: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 0.5, py: 0.25 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <VisibilityIcon sx={{ fontSize: 12, color: c.status.info }} />
                    <Typography sx={{ color: c.text.muted, fontSize: '0.72rem', fontWeight: 600 }}>Read-only</Typography>
                    <Chip label={data.read!.length} size="small" sx={{ bgcolor: c.bg.page, color: c.text.ghost, fontSize: '0.6rem', height: 14, '& .MuiChip-label': { px: 0.4 } }} />
                  </Box>
                  <PermToggle value={getGroupPolicy(data.read!) === 'mixed' ? 'ask' : getGroupPolicy(data.read!)} onChange={(v) => handleGroupPermissionChange(tool.id, data.read!, v)} size={14} />
                </Box>
                {data.read!.map((name) => {
                  const schemaKey = `${tool.id}:${name}`;
                  const schema = schemas[name];
                  const schemaProps = schema?.properties as Record<string, any> | undefined;
                  const schemaRequired = (schema?.required || []) as string[];
                  return (
                    <Box key={name}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.4, px: 1.5, borderRadius: 1, cursor: devMode && schema ? 'pointer' : undefined, '&:hover': { bgcolor: c.bg.secondary } }} onClick={() => devMode && schema && setExpandedSchema((p) => p === schemaKey ? null : schemaKey)}>
                        <Box sx={{ minWidth: 0, flex: 1, mr: 1 }}>
                          <Typography sx={{ color: c.text.primary, fontSize: '0.8rem', fontWeight: 500 }}>{toDisplayName(name, serviceName)}</Typography>
                          {descriptions[name] && <Typography sx={{ color: c.text.ghost, fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{firstSentence(descriptions[name])}</Typography>}
                        </Box>
                        <PermToggle value={perms[name] || 'ask'} onChange={(v) => handlePermissionChange(tool.id, name, v)} size={14} />
                      </Box>
                      {devMode && expandedSchema === schemaKey && schemaProps && (
                        <Box sx={{ mx: 1.5, mb: 0.75, px: 1.5, py: 1, bgcolor: c.bg.page, borderRadius: 1, border: `1px solid ${c.border.subtle}` }}>
                          <Typography sx={{ color: c.text.ghost, fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', mb: 0.5 }}>Input Parameters</Typography>
                          {Object.entries(schemaProps).map(([pName, pDef]: [string, any]) => (
                            <Box key={pName} sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, py: 0.2 }}>
                              <Typography sx={{ color: c.accent.primary, fontSize: '0.72rem', fontFamily: c.font.mono, fontWeight: 600, flexShrink: 0 }}>{pName}</Typography>
                              <Typography sx={{ color: c.text.muted, fontSize: '0.68rem', fontFamily: c.font.mono }}>{pDef?.type || 'any'}</Typography>
                              {schemaRequired.includes(pName) && <Chip label="required" size="small" sx={{ bgcolor: `${c.status.error}12`, color: c.status.error, fontSize: '0.55rem', height: 14, '& .MuiChip-label': { px: 0.4 } }} />}
                              {pDef?.description && <Typography sx={{ color: c.text.ghost, fontSize: '0.68rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pDef.description}</Typography>}
                            </Box>
                          ))}
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>
            )}
            {(data.write?.length || 0) > 0 && (
              <Box sx={{ mt: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 0.5, py: 0.25 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <EditIcon sx={{ fontSize: 12, color: c.status.warning }} />
                    <Typography sx={{ color: c.text.muted, fontSize: '0.72rem', fontWeight: 600 }}>Write / delete</Typography>
                    <Chip label={data.write!.length} size="small" sx={{ bgcolor: c.bg.page, color: c.text.ghost, fontSize: '0.6rem', height: 14, '& .MuiChip-label': { px: 0.4 } }} />
                  </Box>
                  <PermToggle value={getGroupPolicy(data.write!) === 'mixed' ? 'ask' : getGroupPolicy(data.write!)} onChange={(v) => handleGroupPermissionChange(tool.id, data.write!, v)} size={14} />
                </Box>
                {data.write!.map((name) => {
                  const schemaKey = `${tool.id}:${name}`;
                  const schema = schemas[name];
                  const schemaProps = schema?.properties as Record<string, any> | undefined;
                  const schemaRequired = (schema?.required || []) as string[];
                  return (
                    <Box key={name}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.4, px: 1.5, borderRadius: 1, cursor: devMode && schema ? 'pointer' : undefined, '&:hover': { bgcolor: c.bg.secondary } }} onClick={() => devMode && schema && setExpandedSchema((p) => p === schemaKey ? null : schemaKey)}>
                        <Box sx={{ minWidth: 0, flex: 1, mr: 1 }}>
                          <Typography sx={{ color: c.text.primary, fontSize: '0.8rem', fontWeight: 500 }}>{toDisplayName(name, serviceName)}</Typography>
                          {descriptions[name] && <Typography sx={{ color: c.text.ghost, fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{firstSentence(descriptions[name])}</Typography>}
                        </Box>
                        <PermToggle value={perms[name] || 'ask'} onChange={(v) => handlePermissionChange(tool.id, name, v)} size={14} />
                      </Box>
                      {devMode && expandedSchema === schemaKey && schemaProps && (
                        <Box sx={{ mx: 1.5, mb: 0.75, px: 1.5, py: 1, bgcolor: c.bg.page, borderRadius: 1, border: `1px solid ${c.border.subtle}` }}>
                          <Typography sx={{ color: c.text.ghost, fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', mb: 0.5 }}>Input Parameters</Typography>
                          {Object.entries(schemaProps).map(([pName, pDef]: [string, any]) => (
                            <Box key={pName} sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, py: 0.2 }}>
                              <Typography sx={{ color: c.accent.primary, fontSize: '0.72rem', fontFamily: c.font.mono, fontWeight: 600, flexShrink: 0 }}>{pName}</Typography>
                              <Typography sx={{ color: c.text.muted, fontSize: '0.68rem', fontFamily: c.font.mono }}>{pDef?.type || 'any'}</Typography>
                              {schemaRequired.includes(pName) && <Chip label="required" size="small" sx={{ bgcolor: `${c.status.error}12`, color: c.status.error, fontSize: '0.55rem', height: 14, '& .MuiChip-label': { px: 0.4 } }} />}
                              {pDef?.description && <Typography sx={{ color: c.text.ghost, fontSize: '0.68rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pDef.description}</Typography>}
                            </Box>
                          ))}
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        </Collapse>
      </Box>
    );
  };

  const isDisabled = tool.enabled === false;

  // Defensive Reddit detection so onboarding hooks still attach when ig.id lookup fails (legacy/manual installs).
  const isReddit =
    ig?.id === 'reddit' ||
    tool.name?.toLowerCase() === 'reddit' ||
    (tool.command || '').toLowerCase().includes('reddit');
  const isYoutube =
    ig?.id === 'youtube' ||
    tool.name?.toLowerCase() === 'youtube' ||
    (tool.command || '').toLowerCase().includes('youtube');
  return (
                  <Card
                    key={tool.id}
                    sx={{ order: tool.auth_status === 'connected' ? 0 : 1, bgcolor: c.bg.surface, border: `1px solid ${isExpanded ? c.accent.primary : c.border.subtle}`, borderRadius: 2, boxShadow: c.shadow.sm, '&:hover': { borderColor: isDisabled ? c.border.subtle : c.accent.primary, boxShadow: isDisabled ? undefined : '0 0 0 1px rgba(174,86,48,0.12)' }, transition: 'border-color 0.2s, box-shadow 0.2s' }}
                  >
                    <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 2, cursor: isDisabled ? 'default' : 'pointer' }}
                        data-onboarding={isYoutube ? 'actions-youtube-chevron' : isReddit ? 'actions-reddit-chevron' : undefined}
                        onClick={() => !isDisabled && onToggleExpand(tool.id, isExpanded)}
                      >
                        {ig && (
                          <Box sx={{
                            width: 36, height: 36, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            bgcolor: `${ig.color}18`, fontSize: '1.1rem', fontWeight: 700, color: ig.color, flexShrink: 0,
                            opacity: isDisabled ? 0.4 : 1, transition: 'opacity 0.2s',
                          }}>
                            {ig.icon}
                          </Box>
                        )}
                        <Box sx={{ flex: 1, minWidth: 0, opacity: isDisabled ? 0.4 : 1, transition: 'opacity 0.2s' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                            <Typography sx={{ color: c.text.primary, fontWeight: 600, fontSize: '0.95rem' }}>{tool.name}</Typography>
                            {isMcp && <Chip icon={<ExtensionIcon sx={{ fontSize: 12 }} />} label={isStdio ? 'MCP · stdio' : 'MCP'} size="small" sx={{ bgcolor: `${c.status.warning}20`, color: c.status.warning, fontSize: '0.75rem', height: 24 }} />}
                            {tool.command && <Chip icon={<TerminalIcon sx={{ fontSize: 12 }} />} label={`/${tool.command}`} size="small" sx={{ bgcolor: 'rgba(174,86,48,0.12)', color: c.accent.hover, fontSize: '0.72rem', height: 22 }} />}
                            {tool.auth_status === 'connected' && !ig && (
                              <Chip icon={<CheckCircleIcon sx={{ fontSize: 12 }} />} label={tool.connected_account_email ? `Connected · ${tool.connected_account_email}` : 'Connected'} size="small" sx={{ bgcolor: c.status.successBg, color: c.status.success, fontSize: '0.7rem', height: 20, '& .MuiChip-icon': { color: c.status.success } }} />
                            )}
                            {tool.auth_status === 'configured' && !ig?.credentialFields && (
                              <Chip icon={<SettingsIcon sx={{ fontSize: 12 }} />} label="Configured" size="small" sx={{ bgcolor: c.status.warningBg, color: c.status.warning, fontSize: '0.7rem', height: 20, '& .MuiChip-icon': { color: c.status.warning } }} />
                            )}
                            {ig && totalToolCount > 0 && (
                              <Chip label={`${totalToolCount} actions`} size="small" sx={{ bgcolor: `${ig.color}15`, color: ig.color, fontSize: '0.7rem', height: 20, '& .MuiChip-label': { px: 0.6 } }} />
                            )}
                            {ig && (
                              <Chip component="a" href={ig.website} clickable icon={<OpenInNewIcon sx={{ fontSize: 10 }} />} label="docs" size="small" sx={{ bgcolor: c.bg.secondary, color: c.text.ghost, fontSize: '0.65rem', height: 18, '& .MuiChip-label': { px: 0.4 }, '& .MuiChip-icon': { ml: 0.4, fontSize: 10 } }} />
                            )}
                          </Box>
                          {tool.description && <Typography sx={{ color: c.text.muted, fontSize: '0.84rem' }}>{tool.description}</Typography>}
                        </Box>
                        {!isDisabled && (tool.auth_type === 'oauth2' || ig?.authType === 'oauth2') && (tool.auth_status !== 'connected' || ig?.id === 'discord') && (
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<LinkIcon sx={{ fontSize: 14 }} />}
                            onClick={(e) => { e.stopPropagation(); handleOAuthConnect(tool.id); }}
                            sx={{ borderColor: `${c.status.info}40`, color: c.status.info, '&:hover': { borderColor: c.status.info, bgcolor: `${c.status.info}10` }, textTransform: 'none', fontSize: '0.78rem', borderRadius: 1.5, py: 0.5, flexShrink: 0 }}
                          >
                            {ig?.id === 'discord' && tool.auth_status === 'connected' ? 'Add server' : `Connect ${tool.name}`}
                          </Button>
                        )}
                        {!isDisabled && ig?.authType === 'device_code' && tool.auth_status !== 'connected' && (
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<LinkIcon sx={{ fontSize: 14 }} />}
                            onClick={(e) => { e.stopPropagation(); handleDeviceCodeConnect(tool.id); }}
                            sx={{ borderColor: `${ig.color}40`, color: ig.color, '&:hover': { borderColor: ig.color, bgcolor: `${ig.color}10` }, textTransform: 'none', fontSize: '0.78rem', borderRadius: 1.5, py: 0.5, flexShrink: 0 }}
                          >
                            Connect Microsoft 365
                          </Button>
                        )}
                        {!isDisabled && ig?.credentialFields && tool.auth_status !== 'connected' && (
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<LinkIcon sx={{ fontSize: 14 }} />}
                            onClick={(e) => { e.stopPropagation(); openCredentialsDialog(tool.id, ig); }}
                            sx={{ borderColor: `${ig.color}40`, color: ig.color, '&:hover': { borderColor: ig.color, bgcolor: `${ig.color}10` }, textTransform: 'none', fontSize: '0.78rem', borderRadius: 1.5, py: 0.5, flexShrink: 0 }}
                          >
                            {ig.connectLabel || 'Connect'}
                          </Button>
                        )}
                        {!isDisabled && ig && tool.auth_status === 'connected' && (
                          <Tooltip title={ig.credentialFields || ig.authType === 'oauth2' || ig.authType === 'device_code' ? 'Disconnect' : ''}>
                            <Chip
                              icon={<CheckCircleIcon sx={{ fontSize: 12 }} />}
                              label={tool.connected_account_email ? `Connected · ${tool.connected_account_email}` : 'Connected'}
                              size="small"
                              onDelete={(ig.credentialFields || ig.authType === 'oauth2' || ig.authType === 'device_code') ? (e: React.SyntheticEvent) => { e.stopPropagation(); ig.authType === 'device_code' ? handleM365Disconnect(tool.id) : handleDisconnectIntegration(tool.id, ig); } : undefined}
                              onClick={(e) => e.stopPropagation()}
                              sx={{ bgcolor: c.status.successBg, color: c.status.success, fontSize: '0.7rem', height: 22, '& .MuiChip-icon': { color: c.status.success }, '& .MuiChip-deleteIcon': { color: c.status.success, '&:hover': { color: c.status.error } }, flexShrink: 0 }}
                            />
                          </Tooltip>
                        )}
                        {ig && (
                          <Box
                            data-onboarding={
                              isYoutube
                                ? 'actions-youtube-toggle'
                                : isReddit
                                  ? 'actions-reddit-toggle'
                                  : undefined
                            }
                            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {!!integrationLoading[ig.id] && <CircularProgress size={16} sx={{ color: ig.color }} />}
                            <Switch
                              checked={tool.enabled !== false}
                              onChange={() => handleIntegrationToggle(ig)}
                              disabled={!!integrationLoading[ig.id]}
                              sx={{
                                '& .MuiSwitch-switchBase.Mui-checked': { color: ig.color },
                                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: ig.color },
                              }}
                            />
                          </Box>
                        )}
                        {!isDisabled && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
                            <KeyboardArrowDownIcon sx={{ fontSize: 18, color: c.text.ghost, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                            {!ig && (
                              <>
                                <Tooltip title="Edit" placement="left"><IconButton size="small" onClick={(e) => { e.stopPropagation(); openEdit(tool); }} sx={{ color: c.text.ghost, '&:hover': { color: c.accent.primary } }}><EditIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                                <Tooltip title="Delete" placement="left"><IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDelete(tool.id); }} sx={{ color: c.text.ghost, '&:hover': { color: c.status.error } }}><DeleteIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                              </>
                            )}
                          </Box>
                        )}
                      </Box>
                    </CardContent>

                    <Collapse in={isExpanded && !isDisabled} timeout={0} unmountOnExit>
                        <Box sx={{ px: 2, pb: 2, pt: 0, borderTop: `1px solid ${c.border.subtle}` }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1.5, mb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <SecurityIcon sx={{ fontSize: 14, color: c.text.muted }} />
                              <Typography sx={{ color: c.text.muted, fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Action Permissions</Typography>
                              {hasPerms && <Chip label={`${totalToolCount} actions`} size="small" sx={{ bgcolor: c.bg.secondary, color: c.text.ghost, fontSize: '0.65rem', height: 18, ml: 0.5, '& .MuiChip-label': { px: 0.6 } }} />}
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              {hasPerms && (
                                <>
                                  <Tooltip title="Allow all read-only actions">
                                    <Button size="small" onClick={() => handleBulkReadOnly(tool.id)} sx={{ color: c.status.info, textTransform: 'none', fontSize: '0.7rem', minWidth: 'auto', px: 1, py: 0.25 }}>
                                      Allow reads
                                    </Button>
                                  </Tooltip>
                                  <Tooltip title="Reset all to Ask">
                                    <Button size="small" onClick={() => handleResetPermissions(tool.id)} sx={{ color: c.text.ghost, textTransform: 'none', fontSize: '0.7rem', minWidth: 'auto', px: 1, py: 0.25 }}>
                                      Reset
                                    </Button>
                                  </Tooltip>
                                </>
                              )}
                              <Tooltip title="Discover / refresh actions from MCP server">
                                <IconButton
                                  size="small"
                                  onClick={() => handleDiscover(tool.id)}
                                  disabled={discovering || !canDiscover}
                                  sx={{ color: c.text.ghost, '&:hover': { color: c.accent.primary } }}
                                >
                                  {discovering ? <CircularProgress size={14} sx={{ color: c.text.ghost }} /> : <RefreshIcon sx={{ fontSize: 16 }} />}
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </Box>

                          {!hasPerms ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3, gap: 1.5 }}>
                              <ExtensionIcon sx={{ fontSize: 28, color: c.text.ghost, opacity: 0.4 }} />
                              <Typography sx={{ color: c.text.ghost, fontSize: '0.82rem' }}>No actions discovered yet</Typography>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={discovering ? <CircularProgress size={12} /> : <SearchIcon sx={{ fontSize: 14 }} />}
                                onClick={() => handleDiscover(tool.id)}
                                disabled={discovering || !canDiscover}
                                sx={{ borderColor: c.border.medium, color: c.text.secondary, '&:hover': { borderColor: c.accent.primary, color: c.accent.primary }, textTransform: 'none', fontSize: '0.78rem', borderRadius: 1.5 }}
                              >
                                Discover Actions
                              </Button>
                              {!canDiscover && (
                                <Typography sx={{ color: c.text.ghost, fontSize: '0.72rem' }}>Add an MCP configuration to enable action discovery</Typography>
                              )}
                            </Box>
                          ) : (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                              {serviceNames.map((svc, idx) => (
                                <ServiceGroup key={svc} serviceName={svc} data={services![svc]} isFirstGroup={idx === 0} />
                              ))}
                            </Box>
                          )}

                          {devMode && isMcp && (
                            <Box sx={{ mt: 2, pt: 1.5, borderTop: `1px solid ${c.border.subtle}`, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                              <Typography sx={{ color: c.text.muted, fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Developer Info
                              </Typography>
                              <Box sx={{ bgcolor: c.bg.page, borderRadius: 1.5, border: `1px solid ${c.border.subtle}`, px: 1.5, py: 1 }}>
                                <Typography sx={{ color: c.text.ghost, fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', mb: 0.5 }}>
                                  MCP Config
                                </Typography>
                                <Typography component="pre" sx={{ color: c.text.muted, fontSize: '0.75rem', fontFamily: c.font.mono, whiteSpace: 'pre-wrap', wordBreak: 'break-all', m: 0, lineHeight: 1.5 }}>
                                  {JSON.stringify(tool.mcp_config, null, 2)}
                                </Typography>
                              </Box>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Typography sx={{ color: c.text.ghost, fontSize: '0.72rem' }}>Auth type:</Typography>
                                  <Typography sx={{ color: c.text.muted, fontSize: '0.72rem', fontFamily: c.font.mono }}>{tool.auth_type || 'none'}</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Typography sx={{ color: c.text.ghost, fontSize: '0.72rem' }}>Status:</Typography>
                                  <Typography sx={{ color: c.text.muted, fontSize: '0.72rem', fontFamily: c.font.mono }}>{tool.auth_status || 'none'}</Typography>
                                </Box>
                                {tool.connected_account_email && (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <Typography sx={{ color: c.text.ghost, fontSize: '0.72rem' }}>Account:</Typography>
                                    <Typography sx={{ color: c.text.muted, fontSize: '0.72rem', fontFamily: c.font.mono }}>{tool.connected_account_email}</Typography>
                                  </Box>
                                )}
                              </Box>
                              {tool.credentials && Object.keys(tool.credentials).length > 0 && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                                  <Typography sx={{ color: c.text.ghost, fontSize: '0.72rem' }}>Credentials:</Typography>
                                  {Object.keys(tool.credentials).map((key) => (
                                    <Chip key={key} label={`${key}: configured`} size="small" sx={{ bgcolor: `${c.status.success}12`, color: c.status.success, fontSize: '0.65rem', height: 18, fontFamily: c.font.mono, '& .MuiChip-label': { px: 0.6 } }} />
                                  ))}
                                </Box>
                              )}
                            </Box>
                          )}
                        </Box>
                      </Collapse>
                  </Card>
  );
};

export default CustomToolCard;
