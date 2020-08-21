/* * * * * * * * * * * * * * * * * * *
*
*       최초 코드작성자/배포일: 김민성/2020.08.21
*       
*       코드내용: 네이버 지도 API, 카카오 지도 API, OpenStreetMap, VWorld를 사용한 배경지도 및 종로구 노드,링크 데이터 세팅
*       이슈사항: 네이버, 카카오, OpenStreetMap 모두 EPSG:3857 사용중인데 세부적인 보정값이 다른지 노드링크 데이터가 네이버를 제외하곤 정확하게 일치하지 않음
* 
*       proj4에 대한 설명 (http://www.gisdeveloper.co.kr/?p=8882)
*       네이버 Maps API Docs (https://navermaps.github.io/maps.js/docs/index.html)
*       카카오 지도(Web용) API Docs (https://apis.map.kakao.com/web/documentation/)
*
*       네이버와 카카오 지도의 OpenLayers 중첩 구현개념
*         div A: API 지도 (네이버, 카카오)
*         div B: OpenLayers
*         div A 위에 div B 를 두고, 뒤에 깔린 A에 네이버, 카카오 지도 생성.
*         div B 는 배경없이 생성한다. (배경이 없으면, 투명하므로 뒤에 네이버와 카카오 지도가 배경으로 깔리는 효과가 됨)
*         단, 이때 OpenLayers의 관성(Kinetic), 스무스한 Drag,Wheel 기능 등을 동작하지 않도록 설정한다.
*
*         위에 얹혀진 div B (OpenLayers)를 조작하여 좌표가 이동되면
*         현재의 OpenLayers 중심좌표와 API 지도의 중심좌표를 동기화시킨다.
*
*         위에 얹혀진 div B (OpenLayers)를 조작하여 확대정도가 변경되면
*         현재의 OpenLayers ZoomLevel과 API 지도의 ZoomLevel을 동기화시킨다.
*         - 네이버의 경우, OpenLayers와 ZoomLevel 관리체계가 동일한 것으로 보이나,
*           카카오의 경우, (20 - OpenLayers의 ZoomLevel)인 것으로 보임
*
* * * * * * * * * * * * * * * * * * */

/* proj4 EPSG:4326 기본 제공 */
/* 구 네이버 - 현재 TAIMS에서 사용중 */
proj4.defs('EPSG:5179','+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs')
/* 현 네이버, 카카오, OSM */
proj4.defs("EPSG:3857","+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext  +no_defs");
/* 구 다음 (이 소스에서 사용하지않음) */
proj4.defs("EPSG:5181","+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=GRS80 +units=m +no_defs");

ol.proj.setProj4 = proj4;

const _center = [126.98, 37.57]; // 중심좌표

/* 지도 이벤트 관리용 전역변수 선언 */
var kakaoMainView; // view 객체
var kakaoOlMap; // OpenLayers Conatiner
var kakaoMap; // Kakao 지도

var naverMainView; // view 객체
var naverOlMap; // OpenLayers Conatiner
var naverMap; // Naver 지도

/* NODE */
const NODE_STYLE = function(feature) {
	const style = new ol.style.Style({
	      image: new ol.style.Circle({
	        radius: 5, // 노드 크기 설정
	        fill: new ol.style.Fill({
	          color: '#FF0000', // 노드 색상 설정
	        })
	      })
	    });
	return style
};
const P3857_NODE_SOURCE = new ol.source.Vector();
const P3857_NODE_LAYER = new ol.layer.Vector({
  source: P3857_NODE_SOURCE,
  style: NODE_STYLE
});

/* LINK */
const LINK_STYLE = function(feature) {
	const style = new ol.style.Style({
	      stroke: new ol.style.Stroke({
	        color: '#FF0000', // 링크 색상 설정
	        width: 4 // 링크 굵기 설정
	      })
	    });
	return style
};
const P3857_LINK_SOURCE = new ol.source.Vector();
const P3857_LINK_LAYER = new ol.layer.Vector({
  source: P3857_LINK_SOURCE,
  style: LINK_STYLE
});

/* NODE */
const P4326_NODE_SOURCE = new ol.source.Vector();
const P4326_NODE_LAYER = new ol.layer.Vector({
    source: P4326_NODE_SOURCE,
    style: NODE_STYLE
});

/* LINK */
const P4326_LINK_SOURCE = new ol.source.Vector();
const P4326_LINK_LAYER = new ol.layer.Vector({
    source: P4326_LINK_SOURCE,
    style: LINK_STYLE
});

/* NODE */
const P5179_NODE_SOURCE = new ol.source.Vector();
const P5179_NODE_LAYER = new ol.layer.Vector({
    source: P5179_NODE_SOURCE,
    style: NODE_STYLE
});

/* LINK */
const P5179_LINK_SOURCE = new ol.source.Vector();
const P5179_LINK_LAYER = new ol.layer.Vector({
    source: P5179_LINK_SOURCE,
    style: LINK_STYLE
});

// Map_origin = 네이버 구지도(현 타임스)
$(document).ready(function() {
    
    mapInit_origin(); // 현 TAIMS 방식 (구 네이버)
    mapInit_naver(); // 네이버 지도
    mapInit_osm(); // OSM
    mapInit_kakao(); // 카카오 지도
    mapInit_vworld(); // VWorld

    nodeLinkLoad('EPSG:5179'); // 현 TAIMS 방식의 지도에 노드,링크 세팅
    nodeLinkLoad('EPSG:3857'); // 네이버, 카카오 지도에 노드,링크 세팅
    nodeLinkLoad('EPSG:4326'); // VWorld 지도에 노드,링크 세팅

})

/* 현 TAIMS 방식의 지도 표출 */
function mapInit_origin() {

    const _resolutions = [2048, 1024, 512, 256, 128, 64, 32, 16, 8, 4, 2, 1, 0.5, 0.25];
    const _extent = [90112, 1192896, 2187264, 2765760];  // 4 * 3
    const _projection = new ol.proj.Projection({
        code: 'EPSG:5179',
        extent: _extent,
        units: 'm',
        meterPerUnit : 0.5
    });

    /* 최상위 map view 정의 */
    const mainMapView = new ol.View({
        projection: _projection,
        extent: _extent,
        resolutions: _resolutions,
        maxResolution: _resolutions[0],
        zoomFactor: 1,
        center: ol.proj.transform(_center, 'EPSG:4326', 'EPSG:5179'),
        zoom: 6
    });

    const tileLayer = new ol.layer.Tile({
        title : 'Naver Street Map',
        visible : true,
        type : 'base',
        source : new ol.source.XYZ({
            crossOrigin: "Anonymous",
            projection: _projection,
            tileSize: 256,
            minZoom: 0,
            maxZoom: _resolutions.length - 1,
            tileGrid: new ol.tilegrid.TileGrid({
                extent: _extent,
                origin: [_extent[0], _extent[1]],
                resolutions: _resolutions
            }),
            tileUrlFunction: function (tileCoord, pixelRatio, projection) {
                if (tileCoord == null) return undefined;

                var z = tileCoord[0] + 1;
                var x = tileCoord[1];
                var y = tileCoord[2];

                return 'https://simg.pstatic.net/onetile/get/202/0/0/' + z + '/' + x + '/' + y + '/bl_vc_bg/ol_vc_an'; // TAIMS 사용
                // return 'https://map.pstatic.net/nrb/styles/basic/1596785295/' + z + '/' + x + '/' + y + '.png'; // 신규 주소체계
            }
        })
    });

    /* 최상위 map 정의 */
    const map = new ol.Map({
        controls: ol.control.defaults({
            attributionOptions: {
                collapsible: false
            }
        }),
        layers: [
            tileLayer,
            P5179_LINK_LAYER,
            P5179_NODE_LAYER
        ],
        target: 'Map_Origin',
        renderer: 'canvas',
        interactions: ol.interaction.defaults({
            shiftDragZoom: true,
            doubleClickZoom: false
        }),
        view: mainMapView
    });

    $('#projectionCode_Origin').html(_projection.getCode());
}

/* 네이버 지도 표출 */
function mapInit_naver() {

    // OpenLayers DIV: Map_Ol_Naver
    // Daum DIV: Map_Naver

    const zoomDefault = 17;

    // OpenLayers Container 생성
    naverMainView = new ol.View({
        center: ol.proj.transform(_center, 'EPSG:4326', 'EPSG:3857'),
        projection: 'EPSG:3857',
        zoom: zoomDefault,
        minZoom: 10,
        maxZoom: 19
    });

    naverOlMap = new ol.Map({
        target: 'Map_Ol_Naver', // div id
        renderer: 'canvas',
        view: naverMainView, // view 객체
        controls: ol.control.defaults({
            attributionOptions: {
                collapsible: false
            }
        }).extend([
            new ol.control.Zoom(),
            new ol.control.ScaleLine(),
        ]),
        interactions: ol.interaction.defaults({
            dragPan: false,
            mouseWheelZoom: false
        }).extend([
            new ol.interaction.DragPan({kinetic: false}),
            new ol.interaction.MouseWheelZoom({duration:0})
        ]),
        layers: [
            P3857_LINK_LAYER,
            P3857_NODE_LAYER
        ]
    });

    // naver 지도 얹기
    const naverOptions = {
        useStyleMap: true,
        zoom: 17,
        center: new naver.maps.LatLng(37.57, 126.98)
    }

    naverMap = new naver.maps.Map('Map_Naver', naverOptions);

    naverOlMap.on('pointerdrag', function() {
        changeNaverMap()
    })

    naverOlMap.on('moveend', function() {
        changeNaverMap()
    })

    $('#projectionCode_Naver').html('EPSG:3857');

}

/* OSM 지도 표출 */
function mapInit_osm() {

    const osmTileLayer = new ol.layer.Tile({
        source:new ol.source.OSM()
    })

    /* 최상위 map view 정의 */
    const mainMapView = new ol.View({
        center: ol.proj.transform(_center, 'EPSG:4326', 'EPSG:3857'),
        zoom: 11
    });

    /* 최상위 map 정의 */
    const map = new ol.Map({
        controls: ol.control.defaults({
            attributionOptions: {
                collapsible: false
            }
        }),
        layers: [
            osmTileLayer,
            P3857_LINK_LAYER,
            P3857_NODE_LAYER
        ],
        target: 'Map_Osm',
        renderer: 'canvas',
        view: mainMapView
    });

    $('#projectionCode_Osm').html('EPSG:3857');
}

/* 카카오 지도 표출 */
function mapInit_kakao() {

    // OpenLayers DIV: Map_Ol
    // Daum DIV: Map_Daum

    const zoomDefault = 17;

    // OpenLayers Container 생성
    kakaoMainView = new ol.View({
        center: ol.proj.transform(_center, 'EPSG:4326', 'EPSG:3857'),
        projection: 'EPSG:3857',
        zoom: zoomDefault,
        minZoom: 10,
        maxZoom: 19
    });

    kakaoOlMap = new ol.Map({
        target: 'Map_Ol_Kakao',
        renderer: 'canvas',
        view: kakaoMainView,
        controls: ol.control.defaults({
            attributionOptions: {
                collapsible: false
            }
        }).extend([
            new ol.control.Zoom(),
            new ol.control.ScaleLine(),
        ]),
        interactions: ol.interaction.defaults({
            dragPan: false,
            mouseWheelZoom: false
        }).extend([
            new ol.interaction.DragPan({kinetic: false}),
            new ol.interaction.MouseWheelZoom({duration:0})
        ]),
        layers: [
            P3857_LINK_LAYER,
            P3857_NODE_LAYER
        ]
    });

    // kakao 지도 얹기
    const kakaoDiv = document.getElementById('Map_Kakao')

    const kakaoOptions = {
        center: new kakao.maps.LatLng(_center[1], _center[0]),
        level: 20 - zoomDefault,
        draggable: false,
        scrollwheel: false,
        disableDoubleClick: true,
        disableDoubleClickZoom: true,
        tileAnimation: false,
        speed: 0
    }
    kakaoMap = new kakao.maps.Map(kakaoDiv, kakaoOptions);

    kakaoOlMap.on('pointerdrag', function() {
        changeKakaoMap()
    })

    kakaoOlMap.on('moveend', function() {
        changeKakaoMap()
    })

    $('#projectionCode_Kakao').html('EPSG:3857');
}

/* VWorld 지도 표출 */
function mapInit_vworld() {

    /* 최상위 map view 정의 */
    const mainMapView = new ol.View({
        projection: 'EPSG:4326',
        center: _center,
        zoom: 16
    });

    const tileSource = new ol.source.XYZ({
        url: 'http://api.vworld.kr/req/wmts/1.0.0/F971EF38-A449-3F8D-A6A7-E0911427C167/Base/{z}/{y}/{x}.png'
    })

    const tileLayer = new ol.layer.Tile({
        source: tileSource,
        name:"vworld"
    })

    /* 최상위 map 정의 */
    const map = new ol.Map({
        controls: ol.control.defaults({
            attributionOptions: {
                collapsible: false
            }
        }),
        layers: [
            tileLayer,
            P4326_LINK_LAYER,
            P4326_NODE_LAYER
        ],
        target: 'Map_Vworld',
        renderer: 'canvas',
        interactions: ol.interaction.defaults({
            shiftDragZoom: true,
            doubleClickZoom: false
        }),
        view: mainMapView
    });

    $('#projectionCode_Vworld').html('EPSG:4326');

}

function changeNaverMap() {
    // OpenLayers 중심좌표 받아서 카카오 지도 중심좌표로 세팅
    let coord = ol.proj.transform(naverOlMap.getView().getCenter(), 'EPSG:3857', 'EPSG:4326');
    naverMap.setCenter(new naver.maps.LatLng(coord[1], coord[0]));
    // OpenLayers ZoomLevel 받아서 카카오 지도 ZoomLevel에 적용
    let zoomLevel = naverOlMap.getView().getZoom();
    naverMap.setZoom(zoomLevel);
}

function changeKakaoMap() {
    // OpenLayers 중심좌표 받아서 카카오 지도 중심좌표로 세팅
    let coord = ol.proj.transform(kakaoOlMap.getView().getCenter(), 'EPSG:3857', 'EPSG:4326');
    kakaoMap.setCenter(new kakao.maps.LatLng(coord[1], coord[0]));
    // OpenLayers ZoomLevel 받아서 카카오 지도 ZoomLevel에 적용
    let zoomLevel = kakaoOlMap.getView().getZoom();
    kakaoMap.setLevel(20 - zoomLevel);
}

function nodeLinkLoad(proj) {
    setNodeCoord(proj);
    setLinkCoord(proj);
}

function setNodeCoord(target) {
    const features = nodeGeo.features;
    const featuresProps = features.map((v) => v.geometry);

    var targetSource;

    if (target === 'EPSG:5179') {
        targetSource = P5179_NODE_SOURCE
    } else if (target === 'EPSG:3857') {
        targetSource = P3857_NODE_SOURCE
    } else if (target === 'EPSG:4326') {
        targetSource = P4326_NODE_SOURCE
    }

    featuresProps.forEach((value) => {
        let coords = value.coordinates;

        let pFeature = new ol.Feature({
            geometry: new ol.geom.Point(coords).transform('EPSG:4326', target)
        })

        targetSource.addFeature(pFeature);
    })
}

function setLinkCoord(target) {
    const features = linkGeo.features;
    const featuresProps = features.map((v) => v.geometry);

    var targetSource;

    if (target === 'EPSG:5179') {
        targetSource = P5179_LINK_SOURCE
    } else if (target === 'EPSG:3857') {
        targetSource = P3857_LINK_SOURCE
    } else if (target === 'EPSG:4326') {
        targetSource = P4326_LINK_SOURCE
    } else if (target === 'EPSG:5181') {
        targetSource = P5181_LINK_SOURCE
    }

    featuresProps.forEach((value) => {
        let coords = value.coordinates[0];

        let lFeature = new ol.Feature({
            geometry: new ol.geom.LineString(coords).transform('EPSG:4326', target)
        })

        targetSource.addFeature(lFeature);
    })
   
}