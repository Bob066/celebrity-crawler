import axios from 'axios';
import { Celebrity, ContentItem, CrawlerConfig, DataSource } from '@/types';
import { BaseCrawler } from './base';

interface WikipediaSearchResult {
  pageid: number;
  title: string;
}

interface WikipediaPage {
  pageid: number;
  title: string;
  extract: string;
  fullurl: string;
}

export class WikipediaCrawler extends BaseCrawler {
  source: DataSource = 'wikipedia';

  private baseUrl = 'https://en.wikipedia.org/w/api.php';

  validateConfig(): boolean {
    // Wikipedia 不需要 API Key
    return true;
  }

  async *crawl(
    celebrity: Celebrity,
    config?: CrawlerConfig
  ): AsyncGenerator<ContentItem> {
    // 搜索名人页面
    const searchTerms = [celebrity.name, ...celebrity.aliases];

    for (const term of searchTerms) {
      try {
        const page = await this.searchAndGetPage(term);
        if (page) {
          // 获取完整内容
          const content = await this.getFullContent(page.pageid);

          yield this.createContentItem({
            type: 'wiki',
            priority: 4,
            weight: 0.5,
            title: page.title,
            content: content || page.extract,
            sourceUrl: page.fullurl,
            metadata: {
              pageid: page.pageid,
              searchTerm: term,
            },
          });

          // 获取引用的来源
          const references = await this.getReferences(page.pageid);
          for (const ref of references) {
            yield this.createContentItem({
              type: 'wiki',
              priority: 5,
              weight: 0.3,
              title: `参考来源: ${ref.title || '未知'}`,
              content: ref.content,
              sourceUrl: ref.url,
              metadata: {
                type: 'reference',
                parentPageId: page.pageid,
              },
            });
          }

          // 找到一个有效页面后就停止搜索
          break;
        }
      } catch (error) {
        console.error(`Wikipedia 搜索失败 (${term}):`, error);
      }

      await this.delay(500);
    }
  }

  private async searchAndGetPage(
    searchTerm: string
  ): Promise<WikipediaPage | null> {
    // 搜索
    const searchResponse = await axios.get(this.baseUrl, {
      params: {
        action: 'query',
        list: 'search',
        srsearch: searchTerm,
        format: 'json',
        origin: '*',
      },
    });

    const searchResults: WikipediaSearchResult[] =
      searchResponse.data.query?.search || [];

    if (searchResults.length === 0) {
      return null;
    }

    // 获取第一个结果的详细信息
    const pageId = searchResults[0].pageid;

    const pageResponse = await axios.get(this.baseUrl, {
      params: {
        action: 'query',
        pageids: pageId,
        prop: 'extracts|info',
        exintro: true,
        explaintext: true,
        inprop: 'url',
        format: 'json',
        origin: '*',
      },
    });

    const pages = pageResponse.data.query?.pages;
    if (!pages || !pages[pageId]) {
      return null;
    }

    const page = pages[pageId];
    return {
      pageid: page.pageid,
      title: page.title,
      extract: page.extract || '',
      fullurl: page.fullurl || '',
    };
  }

  private async getFullContent(pageId: number): Promise<string | null> {
    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          action: 'query',
          pageids: pageId,
          prop: 'extracts',
          explaintext: true,
          format: 'json',
          origin: '*',
        },
      });

      const pages = response.data.query?.pages;
      if (!pages || !pages[pageId]) {
        return null;
      }

      return pages[pageId].extract || null;
    } catch (error) {
      console.error('获取完整内容失败:', error);
      return null;
    }
  }

  private async getReferences(
    pageId: number
  ): Promise<{ title?: string; content: string; url?: string }[]> {
    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          action: 'query',
          pageids: pageId,
          prop: 'extlinks',
          ellimit: 20,
          format: 'json',
          origin: '*',
        },
      });

      const pages = response.data.query?.pages;
      if (!pages || !pages[pageId]) {
        return [];
      }

      const extlinks = pages[pageId].extlinks || [];
      return extlinks.map((link: { '*': string }) => ({
        content: `外部链接: ${link['*']}`,
        url: link['*'],
      }));
    } catch (error) {
      console.error('获取引用失败:', error);
      return [];
    }
  }
}
