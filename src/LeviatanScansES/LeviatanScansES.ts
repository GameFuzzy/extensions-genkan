import {LanguageCode, SourceInfo, TagType} from "paperback-extensions-common";
import {GenkanLegacy} from "../GenkanLegacy";

const LEVIATANSCANSES_DOMAIN = "https://es.leviatanscans.com"

export const LeviatanScansESInfo: SourceInfo = {
    version: '1.0.0',
    name: 'LeviatanScansES',
    description: 'Extension that pulls manga from es.leviatanscans.com',
    author: 'GameFuzzy',
    authorWebsite: 'http://github.com/gamefuzzy',
    icon: "icon.png",
    hentaiSource: false,
    websiteBaseURL: LEVIATANSCANSES_DOMAIN,
    sourceTags: [
        {
            text: "Notifications",
            type: TagType.GREEN
        }
    ]
}

export class LeviatanScansES extends GenkanLegacy {
    baseUrl: string = LEVIATANSCANSES_DOMAIN
    languageCode: LanguageCode = LanguageCode.ENGLISH
}