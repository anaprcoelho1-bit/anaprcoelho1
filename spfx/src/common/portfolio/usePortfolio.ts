import * as React from 'react';
import { type SPHttpClient } from '@microsoft/sp-http';
import { evaluatePortfolio, IPortfolioEvaluation, modelFieldsChanged, modelFieldValues } from '../../methodology';
import { IPortfolioSource } from './fields';
import { IListLinks, ListNotFoundError, PortfolioRepository } from './PortfolioRepository';

export interface IPortfolioDataProps {
  spHttpClient: SPHttpClient;
  webUrl: string;
  source: IPortfolioSource;
  /** O usuário pode editar itens (exibe as ações de decisão e sincronização). */
  canEdit: boolean;
}

export type PortfolioState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; evaluation: IPortfolioEvaluation; links: IListLinks; warning?: string };

export interface IPortfolioHook {
  state: PortfolioState;
  repository: PortfolioRepository;
  reload: () => void;
}

/** Carrega parâmetros e listas e aplica o motor da metodologia. */
export function usePortfolio(props: IPortfolioDataProps): IPortfolioHook {
  const { spHttpClient, webUrl, source } = props;
  const [state, setState] = React.useState<PortfolioState>({ kind: 'loading' });
  const [version, setVersion] = React.useState(0);
  const repository = React.useMemo(() => new PortfolioRepository(spHttpClient, webUrl, source), [
    spHttpClient,
    webUrl,
    source.parametersUrl,
    source.initiativesList,
    source.decisionsList,
    source.capacityList,
    source.scoresList
  ]);

  React.useEffect(() => {
    let cancelled = false;
    setState((current) => (current.kind === 'ready' ? current : { kind: 'loading' }));
    (async () => {
      const { params, warning } = await repository.loadParameters();
      const [input, links] = await Promise.all([repository.loadInput(params), repository.loadListLinks()]);
      const today = new Date();
      const evaluation = evaluatePortfolio(input, params, today, source.cycle?.trim() || undefined);
      if (!cancelled) {
        setState({ kind: 'ready', evaluation, links, warning });
      }
    })().catch((error: Error) => {
      if (!cancelled) {
        setState({
          kind: 'error',
          message:
            error instanceof ListNotFoundError
              ? `${error.message} Verifique o nome da lista nas propriedades da web part.`
              : `Não foi possível carregar o portfólio: ${error.message}`
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [repository, source.cycle, version]);

  const reload = React.useCallback(() => setVersion((v) => v + 1), []);
  return { state, repository, reload };
}

/**
 * Grava na lista os campos calculados pelo modelo (apenas os itens que mudaram).
 * Retorna quantos itens foram atualizados.
 */
export async function syncModelFields(
  repository: PortfolioRepository,
  evaluation: IPortfolioEvaluation,
  onProgress?: (done: number, total: number) => void
): Promise<number> {
  const pending = evaluation.items
    .map((entry) => ({ entry, values: modelFieldValues(entry) }))
    .filter(({ entry, values }) => modelFieldsChanged(entry, values));
  const now = new Date();
  let done = 0;
  const workers = 4;
  let next = 0;
  const run = async (): Promise<void> => {
    while (next < pending.length) {
      const current = pending[next++];
      await repository.writeModelFields(current.entry.item.id, current.values, now);
      done++;
      if (onProgress) {
        onProgress(done, pending.length);
      }
    }
  };
  const runners: Promise<void>[] = [];
  for (let i = 0; i < Math.min(workers, pending.length); i++) {
    runners.push(run());
  }
  await Promise.all(runners);
  return pending.length;
}
