define([
    'fineuploader'
    ],function(fineuploader){
    return ['$scope','$http','wdDev','wdpMessagePusher','wdAlert','$route',function($scope,$http,wdDev,wdpMessagePusher,wdAlert,$route){

        //$scope相关
        //展示应用列表
        $scope.list = [];

        //当前显示的应用详情
        $scope.info = {};

        //是否selectAll
        $scope.isSelectAll = false;

        //新安装的应用列表
        $scope.newList = [];

        //版本监测
        $scope.serverMatchRequirement = $route.current.locals.versionSupport;

        //全局
        //应用数据列表
        var G_appList = [];

        //上传进度相关
        var G_uploadingList = [];

        //当前的手机是否开启未知来源提示，false当前用户未开启，true开启
        var G_unknownTips = false;

        function getAppListData(){
            $http({
                method: 'get',
                url: '/resource/apps?length=9999'
            }).success(function(data) {

                for( var i = 0,l = data.length ; i<l; i++ ){
                    G_appList.push(changeInfo(data[i]));
                };
                if(G_appList.length == 0){
                    $('.wd-blank').show();
                };
                $scope.list = G_appList;
                changeAppsBlock();
                uploadApk($('.installApp'));
            }).error(function(){
                //wdAlert.alert('Lost connection to phone','Please refresh your browser','Refresh').then(function(){location.reload();});
            });
        };

        //改变某些字段的值
        function changeInfo(data){

            //将字节换算为兆
            data['apk_size'] = Number(data['apk_size']/1024/1024).toFixed(2);
            switch(data['installed_location']){
                case 1:
                    data['installed_location'] = "Phone memory";
                break;
                case 2:
                    data['installed_location'] = "SD card";
                break;
            };

            //是否显示提示
            data['confirmTipShow'] = false;

            //是否显示安装成功
            data['doneTipShow'] = false;

            data['checked'] = false;
            return data;
        };

        //取得具体应用的数据信息
        function getAppInfo(data,package_name){
            for(var i = 0 , l = data.length; i<l;i++ ){
                if(data[i]['package_name'] == package_name){
                    for(var m = 0 , n = data[i]['requested_permission'].length; m < n; m++ ){
                        data[i]['requested_permission'][m] = $scope.$root.DICT.applications.PERMISSIONS[data[i]['requested_permission'][m]] || data[i]['requested_permission'][m];
                    };
                    console.log(data[i]);
                    return data[i];
                };
            };
        };

        //删除单个应用
        function delApp(package_name){
            wdAlert.confirm(
                $scope.$root.DICT.applications.DEL_ONE_APP.TITLE,
                $scope.$root.DICT.applications.DEL_ONE_APP.CONTENT,
                $scope.$root.DICT.applications.DEL_ONE_APP.AGREE,
                $scope.$root.DICT.applications.DEL_ONE_APP.CANCEL
            ).then(function(){
                $http({
                    method: 'delete',
                    url: '/resource/apps/'+package_name
                }).success(function(data) {
                }).error(function(){
                });
                for(var i = 0 , l = $scope.list.length;i < l ; i++ ){
                    if($scope.list[i]['package_name'] == package_name ){
                        $scope.list[i]['confirmTipShow'] = true;
                        break;
                    };
                };
                var mask = $('.mask').css('opacity',0);
                setTimeout(function(){
                    mask.hide().find('.info').hide();
                    $('dd.confirm').css('opacity',0.8);
                },500);
            },function(){

            });
        };

        //删除多个
        function delMoreApps(){
            wdAlert.confirm(
                $scope.$root.DICT.applications.DEL_MORE_APPS.TITLE,
                $scope.$root.DICT.applications.DEL_MORE_APPS.CONTENT,
                $scope.$root.DICT.applications.DEL_MORE_APPS.AGREE,
                $scope.$root.DICT.applications.DEL_MORE_APPS.CANCEL
            ).then(function(){
                var dels = [];
                for(var i = 0 , l = $scope.list.length ; i<l ; i++ ){
                    if( $scope.list[i]['checked'] == true ){
                        dels.push($scope.list[i]['package_name']);
                        $scope.list[i]['confirmTipShow'] = true;
                        $scope.list[i]['checked'] = false;
                    };
                };
                setTimeout(function(){
                    $('.header button.delete-all').hide();
                    $('dd.toolbar').css('opacity',0);
                    $('dd.confirm').css('opacity',0.8);
                },500);

                var i = 0;
                del(dels[i]);
                function del(package_name){
                    $http({
                        method: 'delete',
                        url: '/resource/apps/'+ package_name
                    }).success(function(data) {
                        if(!!dels[i]){
                            del(dels[i]);
                            i++;
                        };
                    }).error(function(){
                    });
                };
            },function(){

            });
        };

        //上传APK
        function uploadApk(btnEles){

            for(var i = 0,l = btnEles.length;i<l;i++ ){
                var uploader = new fineuploader.FineUploaderBasic({
                    button: btnEles[i],
                    request: {
                        endpoint: wdDev.wrapURL('/resource/apps/upload')
                    },
                    validation: {
                        allowedExtensions:['apk']
                    },
                    cors: {
                        expected: true,
                        sendCredentials: true
                    },
                    message:{
                        typeError:"The file's type is error!"
                    },
                    autoUpload: true,
                    callbacks: {
                        onSubmit: function(id,name) {
                            showUploadApp(name);
                            $('.wd-blank').hide();
                        },
                        onProgress: function(id,name,progress,total){
                            updateUpload(name,Math.floor(progress/total*100));
                        },
                        onComplete: function(id, name, data){
                            var result = data.result[0];
                            for(var i = 0, l = $scope.newList.length; i < l ; i++ ){
                                if($scope.newList[i]['file_name'] == name){
                                    $scope.newList[i]['package_name'] = result['package_name'];
                                    $scope.newList[i]['apk_path'] =  result['apk_path'];
                                    $scope.newList[i]['unknown_sources'] = result['unknown_sources'];
                                    if(!G_unknownTips){
                                        G_unknownTips = result['unknown_sources'];
                                    };
                                    if(!G_unknownTips){
                                        showUnknowTips();
                                    };
                                };
                            };
                            $('.header button.reinstall').show();
                        },
                        onerror:function(){
                            //console.log();
                        }
                    }
                });
            };
        };

        //上传安装应用时，显示对应的应用
        function showUploadApp(file_name){
            var item = {
                file_name:file_name,
                progress:'1%',
                progressShow:true,
                doneTipShow: false
            };
            $scope.newList.unshift(item);
            $scope.$apply();
            changeAppsBlock();
        };

        //更新上传进度
        function updateUpload(name,progress){
            for(var i = 0 , l = $scope.newList.length; i < l ; i++ ){
                if( $scope.newList[i]['file_name'] == name ){
                    if( progress == 100 ){
                        $scope.newList[i]['confirmTipShow'] = true;
                        $scope.newList[i]['progressShow'] = false;
                        $scope.$apply();
                    }else{
                        $scope.newList[i]['progress'] = ""+progress+"%";
                        $scope.$apply();
                    };
                    break;
                };
            };
        };

        //显示未知来源应用提示
        function showUnknowTips(){
            var mask = $('.mask');
            var top = $(document).height()*0.2;
            mask.children('.unknowApkTips').show().css({
                'top':top
            });
            setTimeout(function(){
                mask.show();
                setTimeout(function(){
                    mask.css('opacity',1);
                },30);
            },200);
        };

        function reinstall(item){
            var apk_paths = [];
            if(!!item){
                apk_paths.push({'apk_path':item['apk_path']});
            }else{
                for(var i = 0,l = $scope.newList.length; i<l; i++ ){
                    apk_paths.push({'apk_path':$scope.newList[i]['apk_path']});
                };
            };

            $http({
                method: 'post',
                url: '/resource/apps/install',
                data:apk_paths
            }).success(function(data) {

            }).error(function(){

            });
        };

        //上传之后或者过程中关闭那个应用
        function closeUploadApp(item){
            for(var i = 0,l = $scope.newList.length;i<l;i++ ){
                if($scope.newList[i]['file_name'] == item['file_name']){
                    $scope.newList.splice(i,1);
                    break;
                };
            };
        };

        //删除confirm提示
        function closeConfirm(item){
            item['confirmTipShow'] = false;
        };

        //显示对应的应用
        function showAppInfo(package_name){
            var mask = $('.mask');
            mask.children('.info').show();
            $scope.info = getAppInfo(G_appList,package_name);
            setTimeout(function(){
                mask.show();
                setTimeout(function(){
                    mask.css('opacity',1);
                },30);
            },200);
        };

        function closeMask(){
            var mask = $('.mask').css('opacity',0);
             setTimeout(function(){
                mask.hide();
                mask.find('.info').hide();
                mask.find('.unknowApkTips').hide();
            },500);
        };

        function selectAll(){
            var eles = $('.apps-list dl dd.toolbar');
            if($scope.isSelectAll){
                $scope.isSelectAll = false;
                for(var i = 0, l = $scope.list.length; i < l ; i ++ ){
                    $scope.list[i]['checked'] = false;
                    eles.eq(i).css('opacity','');
                };
                $('.header button.select-all p').text($scope.$root.DICT.applications.BUTTONS.SELECT_ALL);
                $('.header button.delete-all').hide();
            }else{
                $scope.isSelectAll = true;
                for(var i = 0, l = $scope.list.length; i < l ; i ++ ){
                    $scope.list[i]['checked'] = true;
                    eles.eq(i).css('opacity',1);
                };
                $('.header button.select-all p').text($scope.$root.DICT.applications.BUTTONS.DESELECT_ALL);
                $('.header button.delete-all').show();
            };
        };

        function checkedApp(e){
            if($(e.target).prop('checked')){
                $('.header button.delete-all').show();
                $(e.target.parentNode.parentNode).css('opacity',1);
            }else{
                $(e.target.parentNode.parentNode).css('opacity','');
                for(var i = 0, l = $scope.list.length; i < l ; i ++ ){
                    if($scope.list[i]['checked']){
                        return;
                    };
                };
                $('.header button.delete-all').hide();
            };
        };

        //改变应用的宽度和高度
        function changeAppsBlock(){
            var docWidth = $(document).width()-90;
            var n = Math.floor(docWidth/170);
            var w = docWidth/n - 10;
            setTimeout(function(){
                var ele = $(".apps-list dl");
                ele.animate({
                    width:w,
                    height:w
                },500);
                ele.find('img').css('margin-top',(w-72-6-20)/2+'px' );
            },100);
            setTimeout(function(){
                $(window).one("resize",changeAppsBlock);
            },1000);
        };

        //webSocket处理
        wdpMessagePusher
            .channel('app_install', function(e, message) {
                var name = message.data.packageName;
                $http({
                    method: 'get',
                    url: '/resource/apps/'+name
                }).success(function(data){

                    setTimeout(function(){
                        for(var i = 0,l = $scope.newList.length;i<l; i++ ){
                            if( $scope.newList[i]['package_name'] == data['package_name'] ){
                                $scope.newList.splice(i,1);
                                break;
                            };
                        };

                        //如果已经安装，移除掉之前版本
                        for(var i = 0,l = $scope.list.length; i<l; i++ ){
                            if($scope.list[i]['package_name'] == data['package_name'] ){
                                $scope.list.splice(i,1);
                                break;
                            };
                        };
                    },100);

                    setTimeout(function(){
                        data['doneTipShow'] = true;
                        $scope.list.unshift(data);
                        $scope.$apply();
                        setTimeout(function(){
                            data['doneTipShow'] = false;
                            $scope.$apply();
                        },4000);
                        changeAppsBlock();
                    },200);


                }).error(function(){
                });
            })
            .channel('app_uninstall', function(e, message) {
                var name = message.data.packageName;
                for(var i = 0,l = $scope.list.length;i<l;i++ ){
                    if($scope.list[i]['package_name']==name){
                        $scope.list.splice(i,1);
                        $scope.$apply();
                        break;
                    };
                };
            });

        //主程序
        getAppListData();

        //析构
        $scope.$on('$destroy', function() {
            wdpMessagePusher.unchannel('*');
        });

        //需要挂载到socpe上面的方法
        $scope.showAppInfo = showAppInfo;
        $scope.closeMask = closeMask;
        $scope.closeConfirm = closeConfirm;
        $scope.selectAll = selectAll;
        $scope.checkedApp = checkedApp;
        $scope.delApp = delApp;
        $scope.delMoreApps = delMoreApps;
        $scope.closeUploadApp = closeUploadApp;
        $scope.reinstall = reinstall;

//最后的括号
    }];
});
