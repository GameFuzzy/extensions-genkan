import {
    Chapter,
    ChapterDetails,
    HomeSection,
    LanguageCode,
    Manga,
    MangaTile,
    MangaUpdates,
    PagedResults,
    RequestHeaders,
    SearchRequest,
    Source,
} from "paperback-extensions-common"

import {Parser} from './GenkanParser'

export abstract class Genkan extends Source {
    /**
     * The Madara URL of the website. Eg. https://webtoon.xyz
     */
    abstract baseUrl: string

    /**
     * The language code which this source supports.
     */
    abstract languageCode: LanguageCode

    /**
     * Helps with CloudFlare for some sources, makes it worse for others; override with empty string if the latter is true
     */
    userAgentRandomizer: string = `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:77.0) Gecko/20100101 Firefox/78.0${Math.floor(Math.random() * 100000)}`

    parser = new Parser()

    async getMangaDetails(mangaId: string): Promise<Manga> {
        const request = createRequestObject({
            url: `${this.baseUrl}/comics/${mangaId}/`,
            method: 'GET',
            headers: this.constructHeaders({})
        })

        let data = await this.requestManager.schedule(request, 1)
        let $ = this.cheerio.load(data.data)

        return this.parser.parseMangaDetails($, mangaId, this)
    }


    async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = createRequestObject({
            url: `${this.baseUrl}/comics/${mangaId}/`,
            method: 'GET',
            headers: this.constructHeaders({})
        })

        let data = await this.requestManager.schedule(request, 1)
        let $ = this.cheerio.load(data.data)

        return this.parser.parseChapterList($, mangaId, this)
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const request = createRequestObject({
            url: `${this.baseUrl}/comics/${mangaId}/${chapterId}/`,
            method: 'GET',
            headers: this.constructHeaders({})
        })

        let data = await this.requestManager.schedule(request, 1)
        let $ = this.cheerio.load(data.data)

        return this.parser.parseChapterDetails($, mangaId, chapterId, this)

    }

    async searchRequest(query: SearchRequest, metadata: any): Promise<PagedResults> {
        // If we're supplied a page that we should be on, set our internal reference to that page. Otherwise, we start from page 1.
        let page = metadata?.page ?? 1

        const request = createRequestObject({
            url: encodeURI(`${this.baseUrl}/comics?query=${query.title}`),
            method: 'GET',
            headers: this.constructHeaders({})
        })
        let data = await this.requestManager.schedule(request, 1)
        let $ = this.cheerio.load(data.data)
        let manga = this.parser.parseSearchSection($, this)
        let mData: any = {page: (page + 1)}
        if (this.parser.isLastPage($)) {
            mData = undefined
        }
        return createPagedResults({
            results: manga,
            metadata: typeof mData?.page === 'undefined' ? undefined : mData
        })
    }

    async filterUpdatedManga(mangaUpdatesFoundCallback: (updates: MangaUpdates) => void, time: Date, ids: string[]): Promise<void> {
        // If we're supplied a page that we should be on, set our internal reference to that page. Otherwise, we start from page 1.
        let page: number = 1
        let loadNextPage = true
        while (loadNextPage) {
            const request = createRequestObject({
                url: `${this.baseUrl}/latest?page=${page}`,
                method: 'GET',
                headers: this.constructHeaders({})
            })

            let data = await this.requestManager.schedule(request, 1)
            let $ = this.cheerio.load(data.data)

            let updatedManga = this.parser.filterUpdatedManga($, time, ids, this)
            loadNextPage = updatedManga.loadNextPage && !this.parser.isLastPage($)
            if (loadNextPage) {
                page++
            }
            if (updatedManga.updates.length > 0) {
                mangaUpdatesFoundCallback(createMangaUpdates({
                    ids: updatedManga.updates
                }))
            }
        }
    }

    /**
     * It's hard to capture a default logic for homepages. So for Madara sources,
     * instead we've provided a homesection reader for the base_url/source_traversal_path/ endpoint.
     * This supports having paged views in almost all cases.
     * @param sectionCallback
     */
    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const sections = [
            {
                request: createRequestObject({
                    url: `${this.baseUrl}/latest?page=0`,
                    method: 'GET',
                    headers: this.constructHeaders({})
                }),
                section: createHomeSection({
                    id: '0',
                    title: 'RECENTLY UPDATED',
                    view_more: true,
                })
            },
            {
                request: createRequestObject({
                    url: `${this.baseUrl}/comics?page=0`,
                    method: 'GET',
                    headers: this.constructHeaders({})
                }),
                section: createHomeSection({
                    id: '1',
                    title: 'POPULAR',
                    view_more: true,
                })
            }
        ]

        const promises: Promise<void>[] = []

        for (const section of sections) {
            // Let the app load empty sections
            sectionCallback(section.section)

            // Get the section data
            promises.push(
                this.requestManager.schedule(section.request, 1).then(response => {
                    const $ = this.cheerio.load(response.data)
                    section.section.items = this.parser.parseHomeSection($, this)
                    sectionCallback(section.section)
                }),
            )
        }

        // Make sure the function completes
        await Promise.all(promises)
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults | null> {
        let page = metadata?.page ?? 1   // Default to page 1
        let sortBy = ''
        switch (homepageSectionId) {
            case '0': {
                sortBy = `latest`
                break
            }
            case '1': {
                sortBy = `comics`
                break
            }
            default:
                return Promise.resolve(null)
        }
        const request = createRequestObject({
            url: `${this.baseUrl}/${sortBy}?page=${page}`,
            method: 'GET',
            headers: this.constructHeaders({})
        })
        let data = await this.requestManager.schedule(request, 1)
        let $ = this.cheerio.load(data.data)
        let collectedIds: string[] = []
        let items: MangaTile[] = this.parser.parseHomeSection($, this, collectedIds)
        // Set up to go to the next page. If we are on the last page, remove the logic.
        let mData: any = {page: (page + 1)}
        if (this.parser.isLastPage($)) {
            mData = undefined
        }

        return createPagedResults({
            results: items,
            metadata: mData
        })
    }

    getCloudflareBypassRequest() {
        return createRequestObject({
            url: `${this.baseUrl}`,
            method: 'GET',
            headers: this.constructHeaders({})
        })
    }

    constructHeaders(headers: any): any {
        if (this.userAgentRandomizer !== '') {
            headers["user-agent"] = this.userAgentRandomizer
        }
        return headers
    }


    async globalRequestHeaders(): Promise<RequestHeaders> {
        if (this.userAgentRandomizer !== '') {
            return {
                "referer": `${this.baseUrl}/`,
                "user-agent": this.userAgentRandomizer,
                "accept": "image/avif,image/apng,image/jpeg;q=0.9,image/png;q=0.9,image/*;q=0.8"
            }
        } else {
            return {
                "referer": `${this.baseUrl}/`,
                "accept": "image/avif,image/apng,image/jpeg;q=0.9,image/png;q=0.9,image/*;q=0.8"
            }
        }
    }

    /**
     * Parses a time string from a Madara source into a Date object.
     */
    protected convertTime(timeAgo: string): Date {
        let time: Date
        let trimmed: number = Number((/\d*/.exec(timeAgo.trim()) ?? [])[0])
        trimmed = (trimmed == 0 && timeAgo.includes('a')) ? 1 : trimmed
        if (timeAgo.includes('mins') || timeAgo.includes('minutes') || timeAgo.includes('minute')) {
            time = new Date(Date.now() - trimmed * 60000)
        } else if (timeAgo.includes('hours') || timeAgo.includes('hour')) {
            time = new Date(Date.now() - trimmed * 3600000)
        } else if (timeAgo.includes('days') || timeAgo.includes('day')) {
            time = new Date(Date.now() - trimmed * 86400000)
        } else if (timeAgo.includes('weeks') || timeAgo.includes('week')) {
            time = new Date(Date.now() - trimmed * 604800000)
        } else if (timeAgo.includes('months') || timeAgo.includes('month')) {
            time = new Date(Date.now() - trimmed * 2548800000)
        } else if (timeAgo.includes('years') || timeAgo.includes('year')) {
            time = new Date(Date.now() - trimmed * 31556952000)
        } else {
            time = new Date(timeAgo)
        }

        return time
    }

}