(function () {
  'use strict';

  angular.module('ui.tree')

    .directive('uiTreeNode', ['treeConfig', 'UiTreeHelper', '$window', '$document', '$timeout', '$rootElement',
      function (treeConfig, UiTreeHelper, $window, $document, $timeout, $rootElement) {
        return {
          require: ['^uiTreeNodes', '^uiTree'],
          restrict: 'A',
          controller: 'TreeNodeController',
          link: function (scope, element, attrs, controllersArr) {
            // todo startPos is unused
            var config = {},
              hasTouch = 'ontouchstart' in window,
              startPos, firstMoving, dragInfo, pos,
              placeElm, hiddenPlaceElm, dragElm,
              treeScope = null,
              elements, // As a parameter for callbacks
              dragDelaying = true,
              dragStarted = false,
              dragTimer = null,
              body = document.body,
              html = document.documentElement,
              document_height,
              document_width,
              dragStart,
              tagName,
              dragMove,
              dragEnd,
              dragStartEvent,
              dragMoveEvent,
              dragEndEvent,
              dragCancelEvent,
              dragDelay,
              bindDrag,
              keydownHandler,
              outOfBounds;
            angular.extend(config, treeConfig);
            if (config.nodeClass) {
              element.addClass(config.nodeClass);
            }
            scope.init(controllersArr);

            scope.collapsed = !!UiTreeHelper.getNodeAttribute(scope, 'collapsed');
            scope.sourceOnly = scope.nodropEnabled || scope.$treeScope.nodropEnabled;

            scope.$watch(attrs.collapsed, function (val) {
              if ((typeof val) == 'boolean') {
                scope.collapsed = val;
              }
            });

            scope.$watch('collapsed', function (val) {
              UiTreeHelper.setNodeAttribute(scope, 'collapsed', val);
              attrs.$set('collapsed', val);
            });

            dragStart = function (e) {
              if (!hasTouch && (e.button == 2 || e.which == 3)) {
                // disable right click
                return;
              }
              if (e.uiTreeDragging || (e.originalEvent && e.originalEvent.uiTreeDragging)) { // event has already fired in other scope.
                return;
              }

              // the element which is clicked.
              var eventElm = angular.element(e.target),
                eventScope = eventElm.scope(),
                cloneElm = element.clone(),
                eventElmTagName, tagName,
                eventObj, tdElm, hStyle;
              if (!eventScope || !eventScope.$type) {
                return;
              }
              if (eventScope.$type != 'uiTreeNode'
                && eventScope.$type != 'uiTreeHandle') { // Check if it is a node or a handle
                return;
              }
              if (eventScope.$type == 'uiTreeNode'
                && eventScope.$handleScope) { // If the node has a handle, then it should be clicked by the handle
                return;
              }

              eventElmTagName = eventElm.prop('tagName').toLowerCase();
              if (eventElmTagName == 'input' ||
                eventElmTagName == 'textarea' ||
                eventElmTagName == 'button' ||
                eventElmTagName == 'select') { // if it's a input or button, ignore it
                return;
              }

              // check if it or it's parents has a 'data-nodrag' attribute
              while (eventElm && eventElm[0] && eventElm[0] != element) {
                if (UiTreeHelper.nodrag(eventElm)) { // if the node mark as `nodrag`, DONOT drag it.
                  return;
                }
                eventElm = eventElm.parent();
              }

              if (!scope.beforeDrag(scope)) {
                return;
              }

              e.uiTreeDragging = true; // stop event bubbling
              if (e.originalEvent) {
                e.originalEvent.uiTreeDragging = true;
              }
              e.preventDefault();
              eventObj = UiTreeHelper.eventObj(e);

              firstMoving = true;
              dragInfo = UiTreeHelper.dragInfo(scope);

              tagName = scope.$element.prop('tagName');

              if (tagName.toLowerCase() === 'tr') {
                placeElm = angular.element($window.document.createElement(tagName));
                tdElm = angular.element($window.document.createElement('td'))
                  .addClass(config.placeholderClass);
                placeElm.append(tdElm);
              } else {
                placeElm = angular.element($window.document.createElement(tagName))
                  .addClass(config.placeholderClass);
              }
              hiddenPlaceElm = angular.element($window.document.createElement(tagName));
              if (config.hiddenClass) {
                hiddenPlaceElm.addClass(config.hiddenClass);
              }

              pos = UiTreeHelper.positionStarted(eventObj, scope.$element);
              placeElm.css('height', UiTreeHelper.height(scope.$element) + 'px');
              placeElm.css('width', UiTreeHelper.width(scope.$element) + 'px');

              dragElm = angular.element($window.document.createElement(scope.$parentNodesScope.$element.prop('tagName')))
                .addClass(scope.$parentNodesScope.$element.attr('class')).addClass(config.dragClass);
              dragElm.css('width', UiTreeHelper.width(scope.$element) + 'px');
              dragElm.css('z-index', 9999);

              // Prevents cursor to change rapidly in Opera 12.16 and IE when dragging an element
              hStyle = (scope.$element[0].querySelector('.angular-ui-tree-handle') || scope.$element[0]).currentStyle;
              if (hStyle) {
                document.body.setAttribute('ui-tree-cursor', $document.find('body').css('cursor') || '');
                $document.find('body').css({'cursor': hStyle.cursor + '!important'});
              }

              if (scope.sourceOnly) {
                placeElm.css('display', 'none');
              }
              scope.$element.after(placeElm);
              scope.$element.after(hiddenPlaceElm);
              if (dragInfo.isClone() && scope.sourceOnly) {
                dragElm.append(cloneElm);
              } else {
                dragElm.append(scope.$element);
              }

              $rootElement.append(dragElm);

              dragElm.css({
                'left': eventObj.pageX - pos.offsetX + 'px',
                'top': eventObj.pageY - pos.offsetY + 'px'
              });
              elements = {
                placeholder: placeElm,
                dragging: dragElm
              };

              // Fire dragStart callback
              scope.$apply(function () {
                scope.$treeScope.$callbacks.dragStart(dragInfo.eventArgs(elements, pos));
              });

              angular.element($document).bind('touchend', dragEndEvent);
              angular.element($document).bind('touchcancel', dragEndEvent);
              angular.element($document).bind('touchmove', dragMoveEvent);
              angular.element($document).bind('mouseup', dragEndEvent);
              angular.element($document).bind('mousemove', dragMoveEvent);
              angular.element($document).bind('mouseleave', dragCancelEvent);

              document_height = Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight);
              document_width = Math.max(body.scrollWidth, body.offsetWidth, html.clientWidth, html.scrollWidth, html.offsetWidth);
            };

            dragMove = function (e) {
              var eventObj = UiTreeHelper.eventObj(e),
                prev,
                next,
                leftElmPos,
                topElmPos,
                top_scroll,
                bottom_scroll,
                target,
                decrease,
                targetX,
                targetY,
                displayElm,
                targetNode,
                targetElm,
                isEmpty,
                targetOffset,
                targetBefore;

              if (dragElm) {
                e.preventDefault();

                if ($window.getSelection) {
                  $window.getSelection().removeAllRanges();
                } else if ($window.document.selection) {
                  $window.document.selection.empty();
                }

                leftElmPos = eventObj.pageX - pos.offsetX;
                topElmPos = eventObj.pageY - pos.offsetY;

                //dragElm can't leave the screen on the left
                if (leftElmPos < 0) {
                  leftElmPos = 0;
                }

                //dragElm can't leave the screen on the top
                if (topElmPos < 0) {
                  topElmPos = 0;
                }

                //dragElm can't leave the screen on the bottom
                if ((topElmPos + 10) > document_height) {
                  topElmPos = document_height - 10;
                }

                //dragElm can't leave the screen on the right
                if ((leftElmPos + 10) > document_width) {
                  leftElmPos = document_width - 10;
                }

                dragElm.css({
                  'left': leftElmPos + 'px',
                  'top': topElmPos + 'px'
                });

                top_scroll = window.pageYOffset || $window.document.documentElement.scrollTop;
                bottom_scroll = top_scroll + (window.innerHeight || $window.document.clientHeight || $window.document.clientHeight);

                // to scroll down if cursor y-position is greater than the bottom position the vertical scroll
                if (bottom_scroll < eventObj.pageY && bottom_scroll <= document_height) {
                  window.scrollBy(0, 10);
                }

                // to scroll top if cursor y-position is less than the top position the vertical scroll
                if (top_scroll > eventObj.pageY) {
                  window.scrollBy(0, -10);
                }

                UiTreeHelper.positionMoved(e, pos, firstMoving);
                if (firstMoving) {
                  firstMoving = false;
                  return;
                }

                // check if add it as a child node first
                // todo decrease is unused
                decrease = (UiTreeHelper.offset(dragElm).left - UiTreeHelper.offset(placeElm).left) >= config.threshold;
                targetX = eventObj.pageX - ($window.pageXOffset || $window.document.body.scrollLeft || $window.document.documentElement.scrollLeft) - ($window.document.documentElement.clientLeft || 0);
                targetY = eventObj.pageY - ($window.pageYOffset || $window.document.body.scrollTop || $window.document.documentElement.scrollTop) - ($window.document.documentElement.clientTop || 0);

                // Select the drag target. Because IE does not support CSS 'pointer-events: none', it will always
                // pick the drag element itself as the target. To prevent this, we hide the drag element while
                // selecting the target.
                if (angular.isFunction(dragElm.hide)) {
                  dragElm.hide();
                } else {
                  displayElm = dragElm[0].style.display;
                  dragElm[0].style.display = 'none';
                }

                // when using elementFromPoint() inside an iframe, you have to call
                // elementFromPoint() twice to make sure IE8 returns the correct value
                $window.document.elementFromPoint(targetX, targetY);

                targetElm = angular.element($window.document.elementFromPoint(targetX, targetY));

                if (angular.isFunction(dragElm.show)) {
                  dragElm.show();
                } else {
                  dragElm[0].style.display = displayElm;
                }

                outOfBounds = !(targetElm.scope().$type);

                // Detect out of bounds condition, update drop target display, and prevent drop
                if (outOfBounds) {

                  // Remove the placeholder
                  placeElm.remove();

                  // If the target was an empty tree, replace the empty element placeholder
                  if (treeScope) {
                    treeScope.resetEmptyElement();
                    treeScope = null;
                  }
                }

                // move horizontal
                if (pos.dirAx && pos.distAxX >= config.levelThreshold) {
                  pos.distAxX = 0;

                  // increase horizontal level if previous sibling exists and is not collapsed
                  if (pos.distX > 0) {
                    prev = dragInfo.prev();
                    if (prev && !prev.collapsed
                      && prev.accept(scope, prev.childNodesCount())) {
                      prev.$childNodesScope.$element.append(placeElm);
                      dragInfo.moveTo(prev.$childNodesScope, prev.childNodes(), prev.childNodesCount());
                    }
                  }

                  // decrease horizontal level
                  if (pos.distX < 0) {
                    // we can't decrease a level if an item preceeds the current one
                    next = dragInfo.next();
                    if (!next) {
                      target = dragInfo.parentNode(); // As a sibling of it's parent node
                      if (target
                        && target.$parentNodesScope.accept(scope, target.index() + 1)) {
                        target.$element.after(placeElm);
                        dragInfo.moveTo(target.$parentNodesScope, target.siblings(), target.index() + 1);
                      }
                    }
                  }
                }

                // move vertical
                if (!pos.dirAx) {
                  // check it's new position
                  targetNode = targetElm.scope();
                  isEmpty = false;
                  if (!targetNode) {
                    return;
                  }

                  // Show the placeholder if it was hidden for nodrop-enabled and this is a new tree
                  if (targetNode.$treeScope && !targetNode.$parent.nodropEnabled && !targetNode.$treeScope.nodropEnabled) {
                    placeElm.css('display', '');
                  }

                  if (targetNode.$type == 'uiTree' && targetNode.dragEnabled) {
                    isEmpty = targetNode.isEmpty(); // Check if it's empty tree
                  }

                  if (targetNode.$type == 'uiTreeHandle') {
                    targetNode = targetNode.$nodeScope;
                  }

                  if (targetNode.$type != 'uiTreeNode'
                    && !isEmpty) { // Check if it is a uiTreeNode or it's an empty tree
                    return;
                  }

                  // if placeholder move from empty tree, reset it.
                  if (treeScope && placeElm.parent()[0] != treeScope.$element[0]) {
                    treeScope.resetEmptyElement();
                    treeScope = null;
                  }

                  if (isEmpty) { // it's an empty tree
                    treeScope = targetNode;
                    if (targetNode.$nodesScope.accept(scope, 0)) {
                      targetNode.place(placeElm);
                      dragInfo.moveTo(targetNode.$nodesScope, targetNode.$nodesScope.childNodes(), 0);
                    }
                  } else if (targetNode.dragEnabled()) { // drag enabled
                    targetElm = targetNode.$element; // Get the element of ui-tree-node
                    targetOffset = UiTreeHelper.offset(targetElm);
                    targetBefore = targetNode.horizontal ? eventObj.pageX < (targetOffset.left + UiTreeHelper.width(targetElm) / 2)
                      : eventObj.pageY < (targetOffset.top + UiTreeHelper.height(targetElm) / 2);

                    if (targetNode.$parentNodesScope.accept(scope, targetNode.index())) {
                      if (targetBefore) {
                        targetElm[0].parentNode.insertBefore(placeElm[0], targetElm[0]);
                        dragInfo.moveTo(targetNode.$parentNodesScope, targetNode.siblings(), targetNode.index());
                      } else {
                        targetElm.after(placeElm);
                        dragInfo.moveTo(targetNode.$parentNodesScope, targetNode.siblings(), targetNode.index() + 1);
                      }
                    } else if (!targetBefore && targetNode.accept(scope, targetNode.childNodesCount())) { // we have to check if it can add the dragging node as a child
                      targetNode.$childNodesScope.$element.append(placeElm);
                      dragInfo.moveTo(targetNode.$childNodesScope, targetNode.childNodes(), targetNode.childNodesCount());
                    } else {
                      outOfBounds = true;
                    }
                  }
                }

                scope.$apply(function () {
                  scope.$treeScope.$callbacks.dragMove(dragInfo.eventArgs(elements, pos));
                });
              }
            };

            dragEnd = function (e) {

              e.preventDefault();

              if (dragElm) {
                scope.$treeScope.$apply(function () {
                  scope.$treeScope.$callbacks.beforeDrop(dragInfo.eventArgs(elements, pos));
                });
                // roll back elements changed
                hiddenPlaceElm.replaceWith(scope.$element);
                placeElm.remove();

                dragElm.remove();
                dragElm = null;
                if (scope.$$apply && !outOfBounds) {
                  scope.$treeScope.$apply(function () {
                    dragInfo.apply();
                    scope.$treeScope.$callbacks.dropped(dragInfo.eventArgs(elements, pos));
                  });
                } else {
                  bindDrag();
                }
                scope.$treeScope.$apply(function () {
                  scope.$treeScope.$callbacks.dragStop(dragInfo.eventArgs(elements, pos));
                });
                scope.$$apply = false;
                dragInfo = null;
              }

              // Restore cursor in Opera 12.16 and IE
              var oldCur = document.body.getAttribute('ui-tree-cursor');
              if (oldCur !== null) {
                $document.find('body').css({'cursor': oldCur});
                document.body.removeAttribute('ui-tree-cursor');
              }

              angular.element($document).unbind('touchend', dragEndEvent); // Mobile
              angular.element($document).unbind('touchcancel', dragEndEvent); // Mobile
              angular.element($document).unbind('touchmove', dragMoveEvent); // Mobile
              angular.element($document).unbind('mouseup', dragEndEvent);
              angular.element($document).unbind('mousemove', dragMoveEvent);
              angular.element($window.document.body).unbind('mouseleave', dragCancelEvent);
            };

            dragStartEvent = function (e) {
              if (scope.dragEnabled()) {
                dragStart(e);
              }
            };

            dragMoveEvent = function (e) {
              dragMove(e);
            };

            dragEndEvent = function (e) {
              scope.$$apply = true;
              dragEnd(e);
            };

            dragCancelEvent = function (e) {
              dragEnd(e);
            };

            dragDelay = (function () {
              var to;

              return {
                exec: function (fn, ms) {
                  if (!ms) {
                    ms = 0;
                  }
                  this.cancel();
                  to = $timeout(fn, ms);
                },
                cancel: function () {
                  $timeout.cancel(to);
                }
              };
            })();

            bindDrag = function () {
              element.bind('touchstart mousedown', function (e) {
                dragDelay.exec(function () {
                  dragStartEvent(e);
                }, scope.dragDelay || 0);
              });
              element.bind('touchend touchcancel mouseup', function () {
                dragDelay.cancel();
              });
            };
            bindDrag();

            keydownHandler = function (e) {
              if (e.keyCode == 27) {
                scope.$$apply = false;
                dragEnd(e);
              }
            };

            angular.element($window.document.body).bind('keydown', keydownHandler);

            //unbind handler that retains scope
            scope.$on('$destroy', function () {
              angular.element($window.document.body).unbind('keydown', keydownHandler);
            });
          }
        };
      }
    ]);

})();
