import * as React from 'react';
import { type IPropertyPaneConfiguration } from '@microsoft/sp-property-pane';
import { type IPortfolioComponentProps, PortfolioWebPartBase } from '../../common/portfolio/PortfolioWebPartBase';
import PortfolioMonitoring, { type IPortfolioMonitoringSettings } from './components/PortfolioMonitoring';

export default class PortfolioMonitoringWebPart extends PortfolioWebPartBase<IPortfolioMonitoringSettings> {
  protected get defaultProperties(): IPortfolioMonitoringSettings {
    return {
      title: 'Monitoramento do Portfólio',
      subtitle: 'Indicadores de gestão do portfólio, semáforo das iniciativas e decisões sugeridas para a revisão periódica.',
      ...this.sourceDefaults()
    };
  }

  protected get component(): React.FC<IPortfolioComponentProps<IPortfolioMonitoringSettings>> {
    return PortfolioMonitoring;
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: { description: 'Indicadores, semáforo e revisão.' },
          groups: [this.textGroup(), this.sourceGroup()]
        }
      ]
    };
  }
}
