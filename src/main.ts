import config from 'config'
import { XMLParser } from 'fast-xml-parser'
import cron from 'node-cron'
import axios from "axios"
import { TwitterApi } from "twitter-api-v2";

type eqvol = {
    title: string,
    id: string,
    updated: Date,
    author: {
        name: string
    },
    link: string,
    content: string
}

const clientCred = {
    appKey: config.get("twitter.appKey"),
    appSecret: config.get("twitter.appSecret"),
    accessToken: config.get("twitter.accessToken"),
    accessSecret: config.get("twitter.accessSecret"),
}

// @ts-ignore
const userClient = new TwitterApi(clientCred)

const search = async () => {
    const parser = new XMLParser()
    const list = await axios.get('https://www.data.jma.go.jp/developer/xml/feed/eqvol.xml')
    const listContent = parser.parse(list.data).feed.entry
    const eq = listContent.map((data: eqvol) => {
        if (data.title.includes("震源・震度")) {
            return data.id
        }
    });

    if (eq[0]) {
        const eqData = await axios.get(eq[0])
        //const eqData = await axios.get("https://www.data.jma.go.jp/developer/xml/data/20220815110016_0_VXSE53_270000.xml")
        const eqDataContent = parser.parse(eqData.data).Report.Body
        const location = eqDataContent.Earthquake.Hypocenter.Area["jmx_eb:Coordinate"].match(/^[\+]?([\-]?[0-9]*\.[0-9])[\+]?([\-]?[0-9]*\.[0-9])(\-[0-9]*)\/$/)
        const latitude = location[1]
        const longtitude = location[2]
        const magnitude = eqDataContent.Earthquake["jmx_eb:Magnitude"]
        const intensity = eqDataContent.Intensity.Observation.MaxInt
        console.log(latitude, longtitude)
        const intRange = ['4', '5-', '5+', '6-']
        if (intRange.includes(intensity) || true) {
            const places = await axios.get(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longtitude}&radius=15000&types=university&language=ja&key=${config.get("maps_api_key")}`)
            const placeData = JSON.parse(JSON.stringify(places.data))
            if (placeData.status === "ZERO_RESULTS") {
                console.log("見つかりませんでした")
            } else if (placeData.results[0].name.includes("大学")) {
                const univName = placeData.results[0].name
                const univ = univName.match(/([\u4E00-\u9FFF]+大学)/)
                if (univ && univ[1]) {
                    const tw = `${univ.slice(-1)[0].trim()}は核実験をやめろ`
                    console.log(tw)
                    await userClient.v1.tweet(tw)
                } else {
                    console.error("大学名の抽出ができません", univName)
                }
            } else {
                console.error("例外エラー")
            }
        }
    }

}

cron.schedule('* * * * *', () => {
    search()
})