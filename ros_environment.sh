#!/usr/bin/env bash
# Source this file before building or launching; load only this workspace's
# optional Gazebo ROS underlay, without replaying another machine's build paths.
source /opt/ros/humble/setup.bash
gazebo_ros_setup="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/.dependencies/gazebo_ros_ws/install/local_setup.bash"
if [[ -f "$gazebo_ros_setup" ]]; then
  source "$gazebo_ros_setup"
fi
unset gazebo_ros_setup
