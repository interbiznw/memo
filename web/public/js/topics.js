(function () {

    var maxNewTopicBytes = 204;

    /**
     * @param {jQuery} $ele
     * @param {string} topic
     * @param {boolean} unfollow
     */
    MemoApp.Form.FollowTopic = function ($ele, topic, unfollow) {
        var $followTopicButton = $ele.find("#follow-topic-button");
        var $followTopicConfirm = $ele.find("#follow-topic-confirm");
        var $followTopicCancel = $ele.find("#follow-topic-cancel");
        var $followTopicCreating = $ele.find("#follow-topic-creating");
        var $followTopicBroadcasting = $ele.find("#follow-topic-broadcasting");
        $followTopicButton.click(function (e) {
            e.preventDefault();
            $followTopicButton.addClass("hidden");
            $followTopicConfirm.removeClass("hidden");
            $followTopicCancel.removeClass("hidden");
        });
        $followTopicCancel.click(function (e) {
            e.preventDefault();
            $followTopicButton.removeClass("hidden");
            $followTopicConfirm.addClass("hidden");
            $followTopicCancel.addClass("hidden");
        });
        var submitting = false;
        $followTopicConfirm.click(function (e) {
            e.preventDefault();

            var password = MemoApp.GetPassword();
            if (!password.length) {
                console.log("Password not set. Please try logging in again.");
                return;
            }

            $followTopicConfirm.addClass("hidden");
            $followTopicCancel.addClass("hidden");
            $followTopicCreating.removeClass("hidden");

            submitting = true;
            $.ajax({
                type: "POST",
                url: MemoApp.GetBaseUrl() + MemoApp.URL.TopicsFollowSubmit,
                data: {
                    topic: topic,
                    unfollow: unfollow,
                    password: password
                },
                success: function (txHash) {
                    submitting = false;
                    if (!txHash || txHash.length === 0) {
                        MemoApp.AddAlert("Server error. Please try refreshing the page.");
                        return
                    }
                    $followTopicCreating.addClass("hidden");
                    $followTopicBroadcasting.removeClass("hidden");
                    $.ajax({
                        type: "POST",
                        url: MemoApp.GetBaseUrl() + MemoApp.URL.MemoWaitSubmit,
                        data: {
                            txHash: txHash
                        },
                        success: function () {
                            submitting = false;
                            window.location.reload();
                        },
                        error: function () {
                            submitting = false;
                            $followTopicBroadcasting.addClass("hidden");
                            console.log("Error waiting for transaction to broadcast.");
                        }
                    });
                },
                error: function (xhr) {
                    submitting = false;
                    if (xhr.status === 401) {
                        MemoApp.AddAlert("Error unlocking key. " +
                            "Please verify your password is correct. " +
                            "If this problem persists, please try refreshing the page.");
                        return;
                    }
                    var errorMessage =
                        "Error with request (response code " + xhr.status + "):\n" +
                        (xhr.responseText !== "" ? xhr.responseText + "\n" : "") +
                        "If this problem persists, try refreshing the page.";
                    MemoApp.AddAlert(errorMessage);
                }
            });
        });
    };

    /**
     * @param {jQuery} $form
     */
    MemoApp.Form.NewTopic = function ($form) {
        var $topicName = $form.find("[name=topic]");
        var $message = $form.find("[name=message]");

        var $topicByteCount = $form.find(".name-byte-count");
        var $msgByteCount = $form.find(".message-byte-count");

        $topicName.on("input", function () {
            setMsgByteCount();
        });
        $message.on("input", function () {
            setMsgByteCount();
        });

        function getByteSize() {
            return MemoApp.utf8ByteLength($topicName.val()) + MemoApp.utf8ByteLength($message.val());
        }

        function setMsgByteCount() {
            var cnt = maxNewTopicBytes - getByteSize();
            $topicByteCount.html("[" + cnt + "]");
            $msgByteCount.html("[" + cnt + "]");
            if (cnt < 0) {
                $topicByteCount.addClass("red");
                $msgByteCount.addClass("red");
            } else {
                $topicByteCount.removeClass("red");
                $msgByteCount.removeClass("red");
            }
        }

        setMsgByteCount();
        var submitting = false;
        $form.submit(function (e) {
            e.preventDefault();
            if (submitting) {
                return
            }

            var topicName = $topicName.val();
            var message = $message.val();
            if (maxNewTopicBytes - getByteSize() < 0) {
                MemoApp.AddAlert("Maximum size is " + maxNewTopicBytes + " bytes. Note that some characters are more than 1 byte." +
                    " Emojis are usually 4 bytes, for example.");
                return;
            }

            if (topicName.match(/[%+]+/)) {
                MemoApp.AddAlert("Characters %,+ are not allowed in a topic name. Sorry for the inconvenience.");
                return;
            }

            if (topicName.search('/') === 0) {
                MemoApp.AddAlert("The / character can't be the first character of the topic name. Sorry for the inconvenience.");
                return;
            }

            if (topicName.length === 0) {
                MemoApp.AddAlert("Must enter a topic name.");
                return;
            }

            if (message.length === 0) {
                MemoApp.AddAlert("Must enter a message.");
                return;
            }

            var password = MemoApp.GetPassword();
            if (!password.length) {
                console.log("Password not set. Please try logging in again.");
                return;
            }

            submitting = true;
            $.ajax({
                type: "POST",
                url: MemoApp.GetBaseUrl() + MemoApp.URL.TopicsCreateSubmit,
                data: {
                    topic: topicName,
                    message: message,
                    password: password
                },
                success: function (txHash) {
                    submitting = false;
                    if (!txHash || txHash.length === 0) {
                        MemoApp.AddAlert("Server error. Please try refreshing the page.");
                        return
                    }
                    window.location = MemoApp.GetBaseUrl() + MemoApp.URL.MemoWait + "/" + txHash
                },
                error: function (xhr) {
                    submitting = false;
                    if (xhr.status === 401) {
                        MemoApp.AddAlert("Error unlocking key. " +
                            "Please verify your password is correct. " +
                            "If this problem persists, please try refreshing the page.");
                        return;
                    }
                    var errorMessage =
                        "Error with request (response code " + xhr.status + "):\n" +
                        (xhr.responseText !== "" ? xhr.responseText + "\n" : "") +
                        "If this problem persists, try refreshing the page.";
                    MemoApp.AddAlert(errorMessage);
                }
            });
        });
    };

    /**
     * @param {string} topic
     * @param {jQuery} $allPosts
     */
    MemoApp.WatchNewTopics = function (topic, $allPosts) {
        function connect() {
            topic = encodeURIComponent(topic);
            var params = "?topic=" + topic + "&lastPostId=" + _lastPostId + "&lastLikeId=" + _lastLikeId;
            var socket = MemoApp.GetSocket(MemoApp.GetBaseUrl() + MemoApp.URL.TopicsSocket + params);

            socket.onclose = function () {
                setTimeout(function () {
                    connect();
                }, 1000);
            };
            /**
             * @param {MessageEvent} msg
             */
            socket.onmessage = function (msg) {
                var data;
                try {
                    data = JSON.parse(msg.data);
                } catch (e) {
                    return;
                }
                var txHash = data.Hash.replace(/['"]+/g, '');
                var $post = $("#topic-post-" + txHash);
                if (data.Type === 2 && !$post.length) {
                    return;
                }
                $.ajax({
                    url: MemoApp.GetBaseUrl() + MemoApp.URL.TopicsPostAjax + "/" + txHash,
                    success: function (html) {
                        if ($post.length) {
                            $post.replaceWith(html);
                            return;
                        }
                        $allPosts.append(html);
                        $allPosts.scrollTop($allPosts[0].scrollHeight);
                    },
                    error: function (xhr) {
                        MemoApp.AddAlert("error getting post via ajax (status: " + xhr.status + ")");
                    }
                });
            };
        }

        connect();
    };

    /**
     * @param {string} topic
     * @param {jQuery} $allPosts
     */
    MemoApp.LoadMore = function (topic, $allPosts) {
        var submitting = false;
        $allPosts.scroll(function () {
            if (submitting) {
                return;
            }
            var pos = $allPosts.scrollTop();
            if (pos === 0) {
                submitting = true;
                $.ajax({
                    url: MemoApp.GetBaseUrl() + MemoApp.URL.TopicsMorePosts,
                    data: {
                        firstPostId: _firstPostId,
                        topic: topic
                    },
                    success: function (html) {
                        submitting = false;
                        if (html === "") {
                            return;
                        }
                        var firstItem = $allPosts.find(":first");
                        var curOffset = firstItem.offset().top - $allPosts.scrollTop();
                        $allPosts.prepend(html);
                        $allPosts.scrollTop(firstItem.offset().top - curOffset);
                    },
                    error: function (xhr) {
                        submitting = false;
                        MemoApp.AddAlert("error getting posts (status: " + xhr.status + ")");
                    }
                });
            }
        });
    };

    var _firstPostId;
    var _lastPostId;
    var _lastLikeId;

    /**
     * @param {number} firstPostId
     */
    MemoApp.SetFirstPostId = function (firstPostId) {
        if (_firstPostId === undefined || firstPostId < _firstPostId) {
            _firstPostId = firstPostId;
        }
    };

    /**
     * @param {number} lastPostId
     */
    MemoApp.SetLastPostId = function (lastPostId) {
        if (_lastPostId === undefined || lastPostId > _lastPostId) {
            _lastPostId = lastPostId;
        }
    };

    /**
     * @param {number} lastLikeId
     */
    MemoApp.SetLastLikeId = function (lastLikeId) {
        if (_lastLikeId === undefined || lastLikeId > _lastLikeId) {
            _lastLikeId = lastLikeId;
        }
    };

    /**
     * @param {jQuery} $broadcasting
     * @param {jQuery} $form
     */
    MemoApp.Form.NewTopicMessage = function ($broadcasting, $creating, $form) {
        var $topicName = $form.find("[name=topic]");
        var $message = $form.find("[name=message]");
        var $msgByteCount = $form.find(".message-byte-count");
        var $message = $form.find("#message");
        var $submitButton = $form.find("#message-submit");

        $message.on("input", function () {
            setMsgByteCount();
        });

        function getByteSize() {
            return MemoApp.utf8ByteLength($topicName.val()) + MemoApp.utf8ByteLength($message.val());
        }

        function setMsgByteCount() {
            var cnt = maxNewTopicBytes - getByteSize();
            $msgByteCount.html("[" + cnt + "]");
            if (cnt < 0) {
                $msgByteCount.addClass("red");
            } else {
                $msgByteCount.removeClass("red");
            }
        }

        setMsgByteCount();
        var submitting = false;
        $form.submit(function (e) {
            e.preventDefault();
            if (submitting) {
                return
            }

            var topicName = $topicName.val();
            var message = $message.val();
            if (maxNewTopicBytes - getByteSize() < 0) {
                MemoApp.AddAlert("Maximum size is " + maxNewTopicBytes + " bytes. Note that some characters are more than 1 byte." +
                    " Emojis are usually 4 bytes, for example.");
                return;
            }

            if (topicName.length === 0) {
                MemoApp.AddAlert("Must enter a topic name.");
                return;
            }

            if (message.length === 0) {
                MemoApp.AddAlert("Must enter a message.");
                return;
            }

            var password = MemoApp.GetPassword();
            if (!password.length) {
                console.log("Password not set. Please try logging in again.");
                return;
            }

            $creating.removeClass("hidden");
            $message.prop('disabled', true);
            $submitButton.prop('disabled', true);

            submitting = true;
            $.ajax({
                type: "POST",
                url: MemoApp.GetBaseUrl() + MemoApp.URL.TopicsCreateSubmit,
                data: {
                    topic: topicName,
                    message: message,
                    password: password
                },
                success: function (txHash) {
                    if (!txHash || txHash.length === 0) {
                        submitting = false;
                        MemoApp.AddAlert("Server error. Please try refreshing the page.");
                        return
                    }
                    $broadcasting.removeClass("hidden");
                    $creating.addClass("hidden");
                    $.ajax({
                        type: "POST",
                        url: MemoApp.GetBaseUrl() + MemoApp.URL.MemoWaitSubmit,
                        data: {
                            txHash: txHash
                        },
                        success: function () {
                            submitting = false;
                            $broadcasting.addClass("hidden");
                            $message.val("");
                            $message.prop('disabled', false);
                            $submitButton.prop('disabled', false);
                            setMsgByteCount();
                        },
                        error: function () {
                            submitting = false;
                            MemoApp.AddAlert("Error waiting for transaction to broadcast.");
                            $broadcasting.addClass("hidden");
                            $message.val("");
                            $message.prop('disabled', false);
                            $submitButton.prop('disabled', false);
                        }
                    });
                },
                error: function (xhr) {
                    submitting = false;
                    $creating.addClass("hidden");
                    $message.prop('disabled', false);
                    $submitButton.prop('disabled', false);
                    if (xhr.status === 401) {
                        MemoApp.AddAlert("Error unlocking key. " +
                            "Please verify your password is correct. " +
                            "If this problem persists, please try refreshing the page.");
                        return;
                    }
                    var errorMessage =
                        "Error with request (response code " + xhr.status + "):\n" +
                        (xhr.responseText !== "" ? xhr.responseText + "\n" : "") +
                        "If this problem persists, try refreshing the page.";
                    MemoApp.AddAlert(errorMessage);
                }
            });
        });
    };

    /**
     * @param {jQuery} $like
     * @param {string} txHash
     */
    MemoApp.Form.NewTopicLike = function ($like, txHash) {
        $like.find("#like-link-" + txHash).click(function (e) {
            e.preventDefault();
            $("#like-info-" + txHash).hide();
            $("#like-form-" + txHash).css({"display": "inline-block"});
        });
        $like.find("#like-cancel-" + txHash).click(function (e) {
            e.preventDefault();
            $("#like-info-" + txHash).show();
            $("#like-form-" + txHash).css({"display": "none"});
        });
        var $form = $like.find("form");

        var $broadcasting = $like.find(".broadcasting");
        var $creating = $like.find(".creating");

        var submitting = false;
        $form.submit(function (e) {
            e.preventDefault();
            if (submitting) {
                return
            }

            $creating.removeClass("hidden");
            $form.hide();

            var txHash = $form.find("[name=tx-hash]").val();
            if (txHash.length === 0) {
                MemoApp.AddAlert("Form error, tx hash not set.");
                return;
            }

            var tip = $form.find("[name=tip]").val();
            if (tip.length !== 0 && tip < 546) {
                MemoApp.AddAlert("Must enter a tip greater than 546 (the minimum dust limit).");
                return;
            }

            var password = MemoApp.GetPassword();
            if (!password.length) {
                console.log("Password not set. Please try logging in again.");
                return;
            }

            submitting = true;
            $.ajax({
                type: "POST",
                url: MemoApp.GetBaseUrl() + MemoApp.URL.MemoLikeSubmit,
                data: {
                    txHash: txHash,
                    tip: tip,
                    password: password
                },
                success: function (txHash) {
                    submitting = false;
                    if (!txHash || txHash.length === 0) {
                        MemoApp.AddAlert("Server error. Please try refreshing the page.");
                        return
                    }
                    $creating.addClass("hidden");
                    $broadcasting.removeClass("hidden");
                    $.ajax({
                        type: "POST",
                        url: MemoApp.GetBaseUrl() + MemoApp.URL.MemoWaitSubmit,
                        data: {
                            txHash: txHash
                        },
                        success: function () {
                            submitting = false;
                            $broadcasting.addClass("hidden");
                        },
                        error: function () {
                            submitting = false;
                            MemoApp.AddAlert("Error waiting for transaction to broadcast.");
                            $broadcasting.addClass("hidden");
                        }
                    });
                },
                error: function (xhr) {
                    submitting = false;
                    if (xhr.status === 401) {
                        MemoApp.AddAlert("Error unlocking key. " +
                            "Please verify your password is correct. " +
                            "If this problem persists, please try refreshing the page.");
                        return;
                    }
                    var errorMessage =
                        "Error with request (response code " + xhr.status + "):\n" +
                        (xhr.responseText !== "" ? xhr.responseText + "\n" : "") +
                        "If this problem persists, try refreshing the page.";
                    MemoApp.AddAlert(errorMessage);
                }
            });
        });
    };
})();
