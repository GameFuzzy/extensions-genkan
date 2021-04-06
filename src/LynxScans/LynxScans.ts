import {LanguageCode, SourceInfo, TagType} from "paperback-extensions-common";
import {GenkanLegacy} from "../GenkanLegacy";

const LYNXSCANS_DOMAIN = "https://lynxscans.com"

export const LynxScansInfo: SourceInfo = {
    version: '1.0.0',
    name: 'LynxScans',
    description: 'Extension that pulls manga from lynxscans.com',
    author: 'GameFuzzy',
    authorWebsite: 'http://github.com/gamefuzzy',
    icon: "icon.png",
    hentaiSource: false,
    websiteBaseURL: LYNXSCANS_DOMAIN,
    sourceTags: [
        {
            text: "Notifications",
            type: TagType.GREEN
        }
    ]
}

export class LynxScans extends GenkanLegacy {
    baseUrl: string = LYNXSCANS_DOMAIN
    languageCode: LanguageCode = LanguageCode.ENGLISH
}