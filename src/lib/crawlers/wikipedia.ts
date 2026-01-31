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
  lang: string;
}

// 维基百科多语言支持
const WIKI_ENDPOINTS = [
  { lang: 'en', url: 'https://en.wikipedia.org/w/api.php', name: '英文维基' },
  { lang: 'zh', url: 'https://zh.wikipedia.org/w/api.php', name: '中文维基' },
];

export class WikipediaCrawler extends BaseCrawler {
  source: DataSource = 'wikipedia';

  validateConfig(): boolean {
    return true;
  }

  async *crawl(
    celebrity: Celebrity,
    config?: CrawlerConfig
  ): AsyncGenerator<ContentItem> {
    const searchTerms = [celebrity.name, ...celebrity.aliases];
    let foundPages = 0;

    console.log(`[Wikipedia] 开始搜索，关键词: ${searchTerms.join(', ')}`);

    // 尝试每个维基百科版本
    for (const wiki of WIKI_ENDPOINTS) {
      console.log(`[Wikipedia] 尝试 ${wiki.name}...`);

      for (const term of searchTerms) {
        try {
          console.log(`[Wikipedia] 搜索: "${term}" 在 ${wiki.name}`);
          const page = await this.searchAndGetPage(term, wiki.url);

          if (page) {
            console.log(`[Wikipedia] 找到页面: ${page.title}`);

            // 获取完整内容
            const content = await this.getFullContent(page.pageid, wiki.url);
            const fullContent = content || page.extract;

            if (fullContent && fullContent.length > 100) {
              yield this.createContentItem({
                type: 'wiki_article',
                priority: 4,
                weight: 0.5,
                title: `[${wiki.name}] ${page.title}`,
                content: fullContent,
                sourceUrl: page.fullurl,
                metadata: {
                  pageid: page.pageid,
                  searchTerm: term,
                  language: wiki.lang,
                  contentLength: fullContent.length,
                },
              });
              foundPages++;

              // 获取章节
              const sections = await this.getSections(page.pageid, wiki.url);
              for (const section of sections) {
                if (section.content && section.content.length > 50) {
                  yield this.createContentItem({
                    type: 'wiki_section',
                    priority: 4,
                    weight: 0.4,
                    title: `[${wiki.name}] ${page.title} - ${section.title}`,
                    content: section.content,
                    sourceUrl: `${page.fullurl}#${encodeURIComponent(section.title)}`,
                    metadata: {
                      section: section.title,
                      parentPageId: page.pageid,
                    },
                  });
                  foundPages++;
                }
              }

              // 获取引用来源
              const references = await this.getReferences(page.pageid, wiki.url);
              for (const ref of references.slice(0, 10)) {
                yield this.createContentItem({
                  type: 'wiki_reference',
                  priority: 5,
                  weight: 0.3,
                  title: `参考来源: ${ref.url}`,
                  content: ref.content,
                  sourceUrl: ref.url,
                  metadata: {
                    type: 'reference',
                    parentPageId: page.pageid,
                  },
                });
                foundPages++;
              }

              console.log(`[Wikipedia] ${wiki.name} 完成，获取 ${foundPages} 条数据`);
              // 这个语言版本找到了，继续下一个语言
              break;
            }
          } else {
            console.log(`[Wikipedia] 未找到: "${term}" 在 ${wiki.name}`);
          }
        } catch (error) {
          console.error(`[Wikipedia] 搜索失败 (${term}):`, error);
        }

        await this.delay(300);
      }
    }

    // 如果什么都没找到，至少返回一个说明
    if (foundPages === 0) {
      console.log(`[Wikipedia] 警告: 未找到任何相关页面`);
      yield this.createContentItem({
        type: 'wiki_not_found',
        priority: 5,
        weight: 0.1,
        title: `Wikipedia 搜索结果`,
        content: `未能在维基百科找到关于 "${celebrity.name}" 的详细信息。尝试的搜索词: ${searchTerms.join(', ')}`,
        sourceUrl: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(celebrity.name)}`,
        metadata: {
          searchTerms,
          status: 'not_found',
        },
      });
    }
  }

  private async searchAndGetPage(
    searchTerm: string,
    baseUrl: string
  ): Promise<WikipediaPage | null> {
    try {
      const searchResponse = await axios.get(baseUrl, {
        params: {
          action: 'query',
          list: 'search',
          srsearch: searchTerm,
          srlimit: 5,
          format: 'json',
          origin: '*',
        },
        timeout: 10000,
      });

      const searchResults: WikipediaSearchResult[] =
        searchResponse.data.query?.search || [];

      console.log(`[Wikipedia] 搜索 "${searchTerm}" 返回 ${searchResults.length} 个结果`);

      if (searchResults.length === 0) {
        return null;
      }

      // 获取第一个结果的详细信息
      const pageId = searchResults[0].pageid;
      console.log(`[Wikipedia] 获取页面详情: ${searchResults[0].title} (ID: ${pageId})`);

      const pageResponse = await axios.get(baseUrl, {
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
        timeout: 10000,
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
        fullurl: page.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
        lang: baseUrl.includes('zh.') ? 'zh' : 'en',
      };
    } catch (error) {
      console.error(`[Wikipedia] API 请求失败:`, error);
      return null;
    }
  }

  private async getFullContent(pageId: number, baseUrl: string): Promise<string | null> {
    try {
      const response = await axios.get(baseUrl, {
        params: {
          action: 'query',
          pageids: pageId,
          prop: 'extracts',
          explaintext: true,
          format: 'json',
          origin: '*',
        },
        timeout: 15000,
      });

      const pages = response.data.query?.pages;
      if (!pages || !pages[pageId]) {
        return null;
      }

      const content = pages[pageId].extract || null;
      console.log(`[Wikipedia] 获取完整内容: ${content ? content.length : 0} 字符`);
      return content;
    } catch (error) {
      console.error('[Wikipedia] 获取完整内容失败:', error);
      return null;
    }
  }

  private async getSections(pageId: number, baseUrl: string): Promise<{ title: string; content: string }[]> {
    try {
      const response = await axios.get(baseUrl, {
        params: {
          action: 'parse',
          pageid: pageId,
          prop: 'sections',
          format: 'json',
          origin: '*',
        },
        timeout: 10000,
      });

      const sections = response.data.parse?.sections || [];
      const results: { title: string; content: string }[] = [];

      // 只获取前5个主要章节
      for (const section of sections.slice(0, 5)) {
        if (section.line && section.index) {
          try {
            const sectionResponse = await axios.get(baseUrl, {
              params: {
                action: 'parse',
                pageid: pageId,
                section: section.index,
                prop: 'text',
                format: 'json',
                origin: '*',
              },
              timeout: 10000,
            });

            const html = sectionResponse.data.parse?.text?.['*'] || '';
            // 简单的 HTML 转文本
            const text = html
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();

            if (text.length > 50) {
              results.push({
                title: section.line,
                content: text.slice(0, 5000), // 限制长度
              });
            }
          } catch (e) {
            console.error(`[Wikipedia] 获取章节失败: ${section.line}`);
          }
          await this.delay(200);
        }
      }

      return results;
    } catch (error) {
      console.error('[Wikipedia] 获取章节列表失败:', error);
      return [];
    }
  }

  private async getReferences(
    pageId: number,
    baseUrl: string
  ): Promise<{ title?: string; content: string; url?: string }[]> {
    try {
      const response = await axios.get(baseUrl, {
        params: {
          action: 'query',
          pageids: pageId,
          prop: 'extlinks',
          ellimit: 20,
          format: 'json',
          origin: '*',
        },
        timeout: 10000,
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
      console.error('[Wikipedia] 获取引用失败:', error);
      return [];
    }
  }
}
