import * as React from 'react';
import { DefaultButton, PrimaryButton } from '@fluentui/react/lib/Button';
import { ChoiceGroup, type IChoiceGroupOption } from '@fluentui/react/lib/ChoiceGroup';
import { Dropdown } from '@fluentui/react/lib/Dropdown';
import { MessageBar, MessageBarType } from '@fluentui/react/lib/MessageBar';
import { Panel, PanelType } from '@fluentui/react/lib/Panel';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';
import { TextField } from '@fluentui/react/lib/TextField';
import {
  ALL_BODIES,
  availableDecisionPoints,
  BODIES,
  IEvaluatedInitiative,
  IPortfolioEvaluation
} from '../../methodology';
import { SectionHeader } from '../SectionHeader';
import { tint } from '../accents';
import { fmtIpp, SUGGESTION_COLORS } from './format';
import { IListLinks, PortfolioRepository } from './PortfolioRepository';
import { IPortfolioHook, syncModelFields } from './usePortfolio';
import styles from './Portfolio.module.scss';

export const Pill: React.FC<{ text: string; color: string; title?: string }> = ({ text, color, title }) =>
  text ? (
    <span className={styles.pill} style={{ color, background: tint(color, 0.12) }} title={title}>
      {text}
    </span>
  ) : null;

export const Dot: React.FC<{ color: string; label?: string }> = ({ color, label }) => (
  <span className={styles.dot} style={{ background: color }} role={label ? 'img' : undefined} aria-label={label} title={label} />
);

export const SuggestionPill: React.FC<{ entry: IEvaluatedInitiative }> = ({ entry }) =>
  entry.suggestion ? (
    <Pill text={entry.suggestion} color={SUGGESTION_COLORS[entry.suggestion] ?? '#1f6fc5'} title={entry.suggestionReason} />
  ) : null;

/** Nome da iniciativa com link para a ficha (formulário de exibição da lista). */
export const InitiativeName: React.FC<{ entry: IEvaluatedInitiative; displayFormUrl?: string }> = ({ entry, displayFormUrl }) => (
  <>
    {displayFormUrl ? (
      <a className={styles.itemTitle} href={`${displayFormUrl}?ID=${entry.item.id}`} target="_blank" rel="noopener noreferrer">
        {entry.item.title || `Iniciativa #${entry.item.id}`}
      </a>
    ) : (
      <span className={styles.itemTitle}>{entry.item.title || `Iniciativa #${entry.item.id}`}</span>
    )}
    <span className={styles.code}>{entry.item.code || entry.generatedCode || `#${entry.item.id}`}</span>
  </>
);

export const IppCell: React.FC<{ entry: IEvaluatedInitiative }> = ({ entry }) =>
  entry.ipp === undefined ? (
    <span className={styles.muted} title={`Notas pendentes: ${entry.missing.join(', ')}`}>
      –
    </span>
  ) : (
    <strong style={{ color: entry.band?.color }} title={entry.band ? `${entry.band.label}: ${entry.band.recommendation}` : undefined}>
      {fmtIpp(entry.ipp)}
    </strong>
  );


/** Grava na lista os campos calculados pelo modelo (ranking, semáforo, alertas, sugestão, código). */
export const SyncButton: React.FC<{ hook: IPortfolioHook }> = ({ hook }) => {
  const [progress, setProgress] = React.useState<string | undefined>();
  const [result, setResult] = React.useState<{ ok: boolean; text: string } | undefined>();
  const state = hook.state;
  if (state.kind !== 'ready') {
    return null;
  }
  const run = (): void => {
    setResult(undefined);
    setProgress('Gravando...');
    syncModelFields(hook.repository, state.evaluation, (done, total) => setProgress(`Gravando ${done}/${total}...`))
      .then((count) => {
        setProgress(undefined);
        setResult({ ok: true, text: count === 0 ? 'A lista já estava atualizada.' : `${count} iniciativas atualizadas na lista.` });
        if (count > 0) {
          hook.reload();
        }
      })
      .catch((error: Error) => {
        setProgress(undefined);
        setResult({ ok: false, text: error.message });
      });
  };
  return (
    <>
      <PrimaryButton
        iconProps={{ iconName: 'Sync' }}
        text={progress ?? 'Atualizar lista'}
        title="Grava na lista de iniciativas o código, a posição no ranking, a leitura do IPP, o semáforo, os alertas, a sugestão do modelo e a alçada; aplica as transições automáticas de situação."
        disabled={!!progress}
        onClick={run}
      />
      {result && (
        <MessageBar
          messageBarType={result.ok ? MessageBarType.success : MessageBarType.error}
          onDismiss={() => setResult(undefined)}
          styles={{ root: { width: 'auto', minHeight: 32 } }}
        >
          {result.text}
        </MessageBar>
      )}
    </>
  );
};

/** Moldura das web parts operacionais: cabeçalho, ferramentas e estados de carregamento/erro. */
export const PortfolioShell: React.FC<{
  title: string;
  subtitle: string;
  hook: IPortfolioHook;
  canEdit: boolean;
  showSync?: boolean;
  tools?: React.ReactNode;
  children: (evaluation: IPortfolioEvaluation, links: IListLinks) => React.ReactNode;
}> = ({ title, subtitle, hook, canEdit, showSync, tools, children }) => {
  const { state } = hook;
  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.topBar}>
          <SectionHeader title={title} subtitle={subtitle} />
          <div className={styles.toolbar}>
            {tools}
            {state.kind === 'ready' && showSync && canEdit && <SyncButton hook={hook} />}
            <DefaultButton iconProps={{ iconName: 'Refresh' }} text="Recarregar" onClick={hook.reload} />
          </div>
        </div>
        {state.kind === 'ready' && (
          <p className={styles.meta}>
            Ciclo {state.evaluation.cycle} · parâmetros da metodologia v{state.evaluation.params.version} · calculado em{' '}
            {state.evaluation.today.toLocaleString('pt-BR')}
          </p>
        )}
        {state.kind === 'loading' && <Spinner size={SpinnerSize.large} label="Carregando o portfólio..." />}
        {state.kind === 'error' && (
          <MessageBar messageBarType={MessageBarType.error} className={styles.message}>
            {state.message}
          </MessageBar>
        )}
        {state.kind === 'ready' && state.warning && (
          <MessageBar messageBarType={MessageBarType.warning} className={styles.message}>
            {state.warning}
          </MessageBar>
        )}
        {state.kind === 'ready' && children(state.evaluation, state.links)}
      </div>
    </section>
  );
};

export const DecisionButton: React.FC<{ entry: IEvaluatedInitiative; canEdit: boolean; onClick: (entry: IEvaluatedInitiative) => void }> = ({
  entry,
  canEdit,
  onClick
}) =>
  canEdit && availableDecisionPoints(entry.item.status).length > 0 ? (
    <DefaultButton text="Decidir" iconProps={{ iconName: 'Gavel' }} onClick={() => onClick(entry)} styles={{ root: { minWidth: 0, padding: '0 8px', height: 28 } }} />
  ) : null;

/**
 * Painel de registro de decisão (pontos de decisão ◆1 a ◆4 e encerramento).
 * Grava no Registro de Decisões e atualiza a situação da iniciativa.
 */
export const DecisionPanel: React.FC<{
  entry: IEvaluatedInitiative | undefined;
  repository: PortfolioRepository;
  onDismiss: () => void;
  onSaved: () => void;
}> = ({ entry, repository, onDismiss, onSaved }) => {
  const points = entry ? availableDecisionPoints(entry.item.status) : [];
  const suggested = entry ? points.find((p) => p.options.some((o) => o.decision === entry.suggestion)) : undefined;
  const [pointKey, setPointKey] = React.useState<string>('');
  const [decision, setDecision] = React.useState<string>('');
  const [body, setBody] = React.useState<string>(BODIES.committee);
  const [justification, setJustification] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();

  React.useEffect(() => {
    if (!entry) {
      return;
    }
    const initial = suggested ?? points[0];
    setPointKey(initial?.key ?? '');
    setDecision(suggested ? entry.suggestion : '');
    setBody(initial?.key === 'PD3' || initial?.key === 'PD1' ? bodyFor(entry) : BODIES.committee);
    setJustification('');
    setError(undefined);
  }, [entry?.item.id]);

  if (!entry) {
    return null;
  }
  const point = points.find((p) => p.key === pointKey);
  const option = point?.options.find((o) => o.decision === decision);
  const missingJustification = !!option?.requiresJustification && justification.trim().length === 0;

  const save = (): void => {
    if (!point || !option) {
      return;
    }
    setSaving(true);
    setError(undefined);
    repository
      .recordDecision(entry.item, point.key, point.label, option.decision, body, justification.trim())
      .then(() => {
        setSaving(false);
        onSaved();
      })
      .catch((e: Error) => {
        setSaving(false);
        setError(e.message);
      });
  };

  const options: IChoiceGroupOption[] = (point?.options ?? []).map((o) => ({
    key: o.decision,
    text: o.decision + (o.decision === entry.suggestion ? ' (sugestão do modelo)' : ''),
    onRenderLabel: (props, render) => (
      <div>
        {render ? render(props) : null}
        <div className={styles.small} style={{ paddingLeft: 26, marginTop: -4 }}>
          {o.description}
        </div>
      </div>
    )
  }));

  return (
    <Panel
      isOpen={true}
      type={PanelType.medium}
      headerText="Registrar decisão"
      onDismiss={onDismiss}
      closeButtonAriaLabel="Fechar"
      isFooterAtBottom={true}
      onRenderFooterContent={() => (
        <div style={{ display: 'flex', gap: 8 }}>
          <PrimaryButton text={saving ? 'Registrando...' : 'Registrar decisão'} disabled={!option || missingJustification || saving} onClick={save} />
          <DefaultButton text="Cancelar" onClick={onDismiss} disabled={saving} />
        </div>
      )}
    >
      <div className={styles.panelSummary}>
        <div className={styles.itemTitle}>{entry.item.title}</div>
        <div className={styles.small}>
          {entry.item.code || entry.generatedCode} · Situação atual: <strong>{entry.item.status || '–'}</strong>
          {entry.ipp !== undefined && <> · IPP {fmtIpp(entry.ipp)}</>}
        </div>
        {entry.suggestion && (
          <div className={styles.small} style={{ marginTop: 6 }}>
            Sugestão do modelo: <SuggestionPill entry={entry} /> {entry.suggestionReason}
          </div>
        )}
        <div className={styles.small} style={{ marginTop: 6 }}>
          Alçada: {entry.authority.label} – {entry.authority.decider}
        </div>
      </div>

      {error && (
        <MessageBar messageBarType={MessageBarType.error} className={styles.message}>
          {error}
        </MessageBar>
      )}

      <div className={styles.field}>
        <Dropdown
          label="Ponto de decisão"
          selectedKey={pointKey}
          options={points.map((p) => ({ key: p.key, text: `${p.label} (${p.step})` }))}
          onChange={(_, o) => {
            setPointKey(String(o?.key ?? ''));
            setDecision('');
          }}
        />
      </div>
      <div className={styles.field}>
        <ChoiceGroup label="Decisão" selectedKey={decision} options={options} onChange={(_, o) => setDecision(String(o?.key ?? ''))} required={true} />
      </div>
      <div className={styles.field}>
        <Dropdown
          label="Instância que decidiu"
          selectedKey={body}
          options={ALL_BODIES.map((b) => ({ key: b, text: b }))}
          onChange={(_, o) => setBody(String(o?.key ?? BODIES.committee))}
        />
      </div>
      <div className={styles.field}>
        <TextField
          label="Justificativa"
          multiline={true}
          rows={5}
          required={!!option?.requiresJustification}
          value={justification}
          onChange={(_, value) => setJustification(value ?? '')}
          description={
            decision === 'Suspender'
              ? 'Registre o ponto de parada e as condições de retomada.'
              : decision === 'Encerrar' || decision === 'Cancelar'
                ? 'Registre o motivo e as lições aprendidas.'
                : 'Decisão registrada é decisão válida: o proponente recebe o motivo.'
          }
        />
      </div>
    </Panel>
  );
};

function bodyFor(entry: IEvaluatedInitiative): string {
  const decider = entry.authority.decider.toLocaleLowerCase('pt-BR');
  if (decider.indexOf('alta gestão') === 0) {
    return BODIES.executive;
  }
  if (decider.indexOf('gestor') === 0) {
    return BODIES.manager;
  }
  return BODIES.committee;
}
