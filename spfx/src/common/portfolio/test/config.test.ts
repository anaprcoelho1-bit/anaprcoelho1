import { ALL_STATUSES, DECISION_POINTS } from '../../../methodology';
import { CAPACITY_FIELDS, DECISION_FIELDS, DEFAULT_SOURCE, INITIATIVE_FIELDS } from '../fields';

interface IFieldConfig {
  internalName: string;
}
interface IListConfig {
  key: string;
  title: string;
  url: string;
  fields: IFieldConfig[];
}
interface IConfig {
  lifecycle: { statuses: string[]; decisions: string[] };
  lists: IListConfig[];
  pages: { name: string; sections: { webPart: string }[] }[];
}

// Executado a partir de lib-commonjs/common/portfolio/test.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const config: IConfig = require('../../../../../provisioning/gestao-portfolio.config.json');

const list = (key: string): IListConfig => config.lists.filter((l) => l.key === key)[0];
const fieldNames = (key: string): string[] => ['Title'].concat(list(key).fields.map((f) => f.internalName));
const values = (map: Record<string, string>): string[] => Object.keys(map).map((k) => map[k]);

describe('configuração de implantação × código', () => {
  it('as situações da lista são as do motor de regras', () => {
    expect(config.lifecycle.statuses).toEqual(ALL_STATUSES);
  });

  it('as decisões da lista são as dos pontos de decisão', () => {
    const decisions: string[] = [];
    DECISION_POINTS.forEach((point) =>
      point.options.forEach((o) => {
        if (decisions.indexOf(o.decision) < 0) {
          decisions.push(o.decision);
        }
      })
    );
    expect(config.lifecycle.decisions).toEqual(decisions);
    const pointLabels = (list('decisions').fields as (IFieldConfig & { choices?: string[] })[]).filter((f) => f.internalName === 'PontoDecisao')[0].choices;
    expect(pointLabels).toEqual(DECISION_POINTS.map((p) => p.label));
  });

  it('as colunas lidas e gravadas pelas web parts existem nas listas', () => {
    const missing = (key: string, names: string[]): string[] => names.filter((name) => fieldNames(key).indexOf(name) < 0);
    // Colunas das notas e VP/CR/IPP são geradas a partir de metodologia.json.
    expect(missing('initiatives', values(INITIATIVE_FIELDS))).toEqual([]);
    expect(missing('decisions', values(DECISION_FIELDS))).toEqual([]);
    expect(missing('capacity', values(CAPACITY_FIELDS))).toEqual([]);
    expect(fieldNames('scores')).toContain('Iniciativa');
  });

  it('os nomes padrão das listas nas web parts são os criados pelo script', () => {
    expect(DEFAULT_SOURCE.initiativesList).toBe(list('initiatives').title);
    expect(DEFAULT_SOURCE.decisionsList).toBe(list('decisions').title);
    expect(DEFAULT_SOURCE.capacityList).toBe(list('capacity').title);
    expect(DEFAULT_SOURCE.scoresList).toBe(list('scores').title);
  });

  it('as páginas usam web parts existentes na solução', () => {
    const manifests = [
      'portfolioPrioritization/PortfolioPrioritizationWebPart',
      'portfolioSelection/PortfolioSelectionWebPart',
      'portfolioMonitoring/PortfolioMonitoringWebPart',
      'portfolioReport/PortfolioReportWebPart',
      'portfolioHero/PortfolioHeroWebPart',
      'quickAccess/QuickAccessWebPart',
      'portfolioAbout/PortfolioAboutWebPart',
      'processSteps/ProcessStepsWebPart',
      'analysisCriteria/AnalysisCriteriaWebPart',
      'portfolioDashboard/PortfolioDashboardWebPart',
      'supportTools/SupportToolsWebPart',
      'institutionalFooter/InstitutionalFooterWebPart'
    ].map((path) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const manifest: { id: string } = require(`../../../../src/webparts/${path}.manifest.json`);
      return manifest.id;
    });
    config.pages.forEach((page) =>
      page.sections.forEach((section) => {
        expect(manifests).toContain(section.webPart);
      })
    );
  });
});
