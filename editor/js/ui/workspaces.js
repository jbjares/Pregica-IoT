/**
 * Copyright 2015, 2016 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/


RED.workspaces = (function() {

    var activeWorkspace = 0;
    var workspaceIndex = 0;

    function addWorkspace(ws) {
        if (ws) {
            workspace_tabs.addTab(ws);
            workspace_tabs.resize();
        } else {
            var tabId = RED.nodes.id();
            do {
                workspaceIndex += 1;
            } while($("#workspace-tabs a[title='"+RED._('workspace.defaultName',{number:workspaceIndex})+"']").size() !== 0);

            ws = {type:"tab",id:tabId,label:RED._('workspace.defaultName',{number:workspaceIndex})};
            RED.nodes.addWorkspace(ws);
            workspace_tabs.addTab(ws);
            workspace_tabs.activateTab(tabId);
            RED.history.push({t:'add',workspaces:[ws],dirty:RED.nodes.dirty()});
            RED.nodes.dirty(true);
        }
    }
    function deleteWorkspace(ws) {
        if (workspace_tabs.count() == 1) {
            return;
        }
        removeWorkspace(ws);
        var historyEvent = RED.nodes.removeWorkspace(ws.id);
        historyEvent.t = 'delete';
        historyEvent.dirty = RED.nodes.dirty();
        historyEvent.workspaces = [ws];
        RED.history.push(historyEvent);
        RED.nodes.dirty(true);
        RED.sidebar.config.refresh();
    }

    function showRenameWorkspaceDialog(id) {
        var workspace = RED.nodes.workspace(id);
        RED.view.state(RED.state.EDITING);
        var trayOptions = {
            title: RED._("workspace.editFlow",{name:workspace.label}),
            buttons: [
                {
                    id: "node-dialog-delete",
                    class: 'leftButton'+((workspace_tabs.count() == 1)?" disabled":""),
                    text: RED._("common.label.delete"), //'<i class="fa fa-trash"></i>',
                    click: function() {
                        deleteWorkspace(workspace);
                        RED.tray.close();
                    }
                },
                {
                    id: "node-dialog-cancel",
                    text: RED._("common.label.cancel"),
                    click: function() {
                        RED.tray.close();
                    }
                },
                {
                    id: "node-dialog-ok",
                    class: "primary",
                    text: RED._("common.label.done"),
                    click: function() {
                        var label = $( "#node-input-name" ).val();
                        if (workspace.label != label) {
                            var changes = {
                                label:workspace.label
                            }
                            var historyEvent = {
                                t: "edit",
                                changes:changes,
                                node: workspace,
                                dirty: RED.nodes.dirty()
                            }
                            RED.history.push(historyEvent);
                            workspace_tabs.renameTab(workspace.id,label);
                            RED.nodes.dirty(true);
                            RED.sidebar.config.refresh();
                            $("#menu-item-workspace-menu-"+workspace.id.replace(".","-")).text(label);
                        }
                        RED.tray.close();
                    }
                }
            ],
            open: function(tray) {
                var trayBody = tray.find('.editor-tray-body');
                var dialogForm = $('<form id="dialog-form" class="form-horizontal"></form>').appendTo(trayBody);
                $('<div class="form-row">'+
                    '<label for="node-input-name" data-i18n="[append]editor:common.label.name"><i class="fa fa-tag"></i> </label>'+
                    '<input type="text" id="node-input-name">'+
                '</div>').appendTo(dialogForm);
                $('<input type="text" style="display: none;" />').prependTo(dialogForm);
                dialogForm.submit(function(e) { e.preventDefault();});
                $("#node-input-name").val(workspace.label);
                dialogForm.i18n();
            },
            close: function() {
                if (RED.view.state() != RED.state.IMPORT_DRAGGING) {
                    RED.view.state(RED.state.DEFAULT);
                }
            }
        }
        RED.tray.show(trayOptions);
    }


    var workspace_tabs;
    function createWorkspaceTabs(){
        workspace_tabs = RED.tabs.create({
            id: "workspace-tabs",
            onchange: function(tab) {
                var event = {
                    old: activeWorkspace
                }
                activeWorkspace = tab.id;
                event.workspace = activeWorkspace;
                RED.events.emit("workspace:change",event);
                RED.sidebar.config.refresh();
            },
            ondblclick: function(tab) {
                if (tab.type != "subflow") {
                    showRenameWorkspaceDialog(tab.id);
                } else {
                    RED.editor.editSubflow(RED.nodes.subflow(tab.id));
                }
            },
            onadd: function(tab) {
                RED.menu.addItem("menu-item-workspace",{
                    id:"menu-item-workspace-menu-"+tab.id.replace(".","-"),
                    label:tab.label,
                    onselect:function() {
                        workspace_tabs.activateTab(tab.id);
                    }
                });
                RED.menu.setDisabled("menu-item-workspace-delete",workspace_tabs.count() == 1);
            },
            onremove: function(tab) {
                RED.menu.setDisabled("menu-item-workspace-delete",workspace_tabs.count() == 1);
                RED.menu.removeItem("menu-item-workspace-menu-"+tab.id.replace(".","-"));
            },
            onreorder: function(oldOrder, newOrder) {
                RED.history.push({t:'reorder',order:oldOrder,dirty:RED.nodes.dirty()});
                RED.nodes.dirty(true);
                setWorkspaceOrder(newOrder);
            },
            minimumActiveTabWidth: 150
        });
    }

    function init() {
        createWorkspaceTabs();
        $('#btn-workspace-add-tab').on("click",function(e) {addWorkspace(); e.preventDefault()});
        RED.events.on("sidebar:resize",workspace_tabs.resize);

        RED.menu.setAction('menu-item-workspace-delete',function() {
            deleteWorkspace(RED.nodes.workspace(activeWorkspace));
        });

        $(window).resize(function() {
            workspace_tabs.resize();
        });
    }

    function removeWorkspace(ws) {
        if (!ws) {
            deleteWorkspace(RED.nodes.workspace(activeWorkspace));
        } else {
            if (workspace_tabs.contains(ws.id)) {
                workspace_tabs.removeTab(ws.id);
            }
        }
    }

    function setWorkspaceOrder(order) {
        RED.nodes.setWorkspaceOrder(order.filter(function(id) {
            return RED.nodes.workspace(id) !== undefined;
        }));
        workspace_tabs.order(order);
    }

    return {
        init: init,
        add: addWorkspace,
        remove: removeWorkspace,
        order: setWorkspaceOrder,
        edit: function(id) {
            showRenameWorkspaceDialog(id||activeWorkspace);
        },
        contains: function(id) {
            return workspace_tabs.contains(id);
        },
        count: function() {
            return workspace_tabs.count();
        },
        active: function() {
            return activeWorkspace
        },
        show: function(id) {
            if (!workspace_tabs.contains(id)) {
                var sf = RED.nodes.subflow(id);
                if (sf) {
                    addWorkspace({type:"subflow",id:id,icon:"red/images/subflow_tab.png",label:sf.name, closeable: true});
                }
            }
            workspace_tabs.activateTab(id);
        },
        refresh: function() {
            RED.nodes.eachWorkspace(function(ws) {
                workspace_tabs.renameTab(ws.id,ws.label);
                $("#menu-item-workspace-menu-"+ws.id.replace(".","-")).text(ws.label);

            })
            RED.nodes.eachSubflow(function(sf) {
                if (workspace_tabs.contains(sf.id)) {
                    workspace_tabs.renameTab(sf.id,sf.name);
                }
            });
            RED.sidebar.config.refresh();
        },
        resize: function() {
            workspace_tabs.resize();
        }
    }
})();
