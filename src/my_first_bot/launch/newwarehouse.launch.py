"""
Run the saved AWS-style warehouse with its matching 2-D map.

The world already contains ``my_robot`` and publishes a 3-D point cloud. This
profile therefore disables the duplicate URDF spawn and converts that cloud to
the ``/scan`` topic consumed by AMCL.
"""

from pathlib import Path
import time

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription, TimerAction
from launch.conditions import IfCondition
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration, PythonExpression
from launch_ros.actions import Node


def generate_launch_description():
    package_share = Path(get_package_share_directory("my_first_bot"))
    full_sim = package_share / "launch" / "full_sim.launch.py"
    world = LaunchConfiguration("world")
    map_yaml = LaunchConfiguration("map")
    map_image = LaunchConfiguration("map_image")
    uwb_tag_config = LaunchConfiguration("uwb_tag_config")
    traffic_profile = LaunchConfiguration("traffic_profile")
    gui = LaunchConfiguration("gui")
    use_web = LaunchConfiguration("use_web")
    use_rviz = LaunchConfiguration("use_rviz")
    database = LaunchConfiguration("database")
    web_port = LaunchConfiguration("web_port")
    vehicle_count = LaunchConfiguration("vehicle_count")
    traffic_speed = LaunchConfiguration("traffic_speed")
    uwb_range_noise = LaunchConfiguration("uwb_range_noise")
    uwb_dropout_rate = LaunchConfiguration("uwb_dropout_rate")
    uwb_maximum_range = LaunchConfiguration("uwb_maximum_range")
    uwb_confirm_threshold = LaunchConfiguration("uwb_confirm_threshold")
    uwb_warning_threshold = LaunchConfiguration("uwb_warning_threshold")
    uwb_max_pair_skew = LaunchConfiguration("uwb_max_pair_skew")
    uwb_validation_hysteresis = LaunchConfiguration("uwb_validation_hysteresis")
    uwb_problem_samples = LaunchConfiguration("uwb_problem_samples")
    uwb_recovery_samples = LaunchConfiguration("uwb_recovery_samples")
    randomize_starts = LaunchConfiguration("randomize_starts")
    spawn_seed = LaunchConfiguration("spawn_seed")
    use_uwb_startup = LaunchConfiguration("use_uwb_startup")
    traffic_model = (
        package_share / "models" / "traffic_vehicle" / "localized_vehicle.sdf.in"
    )
    traffic_starts = (
        (-16.0, -18.0, 0.0),
        (-4.0, -18.0, 0.0),
        (8.0, -18.0, 0.0),
        (9.6, -5.0, 1.52),
        (10.0, 3.0, 1.52),
        (9.1, 14.0, 1.59),
        (4.0, 19.4, 3.14159),
        (-10.0, 19.4, 3.14159),
    )
    traffic_nodes = []
    for index, (x, y, yaw) in enumerate(traffic_starts, start=1):
        name = f"vehicle_{index}"
        namespace = f"traffic/{name}"
        condition = IfCondition(
            PythonExpression([vehicle_count, " >= ", str(index)])
        )
        traffic_nodes.extend(
            [
                Node(
                    package="tf2_ros",
                    executable="static_transform_publisher",
                    name=f"{name}_laser_transform",
                    arguments=[
                        "--x", "0", "--y", "0", "--z", "0.38",
                        "--yaw", "0", "--pitch", "0", "--roll", "0",
                        "--frame-id", f"{name}/base_link",
                        "--child-frame-id", f"{name}/laser",
                    ],
                    condition=condition,
                    output="screen",
                ),
                Node(
                    package="nav2_amcl",
                    executable="amcl",
                    namespace=namespace,
                    name="amcl",
                    remappings=[("map", "/map")],
                    parameters=[
                        {
                            "use_sim_time": True,
                            # Simulated wheel odometry is clean. Keeping its
                            # motion noise modest prevents a scan containing
                            # other vehicles from dragging AMCL off the map.
                            "alpha1": 0.05,
                            "alpha2": 0.05,
                            "alpha3": 0.05,
                            "alpha4": 0.05,
                            "alpha5": 0.05,
                            "base_frame_id": f"{name}/base_link",
                            "global_frame_id": "map",
                            "odom_frame_id": f"{name}/odom",
                            "scan_topic": "scan",
                            "min_particles": 400,
                            "max_particles": 1200,
                            "max_beams": 90,
                            "laser_model_type": "likelihood_field",
                            "do_beamskip": True,
                            "beam_skip_distance": 0.5,
                            "beam_skip_threshold": 0.3,
                            "beam_skip_error_threshold": 0.9,
                            "laser_min_range": 0.15,
                            "laser_max_range": 20.0,
                            "laser_likelihood_max_dist": 2.0,
                            "robot_model_type": "nav2_amcl::DifferentialMotionModel",
                            # UWB supplies initial map x/y after spawning. A
                            # wide yaw covariance lets LiDAR resolve heading.
                            "set_initial_pose": False,
                            "tf_broadcast": True,
                            "transform_tolerance": 0.5,
                            "update_min_d": 0.08,
                            "update_min_a": 0.08,
                            "resample_interval": 1,
                        }
                    ],
                    condition=condition,
                    output="screen",
                ),
                TimerAction(
                    period=5.0 + index * 0.10,
                    actions=[
                        Node(
                            package="nav2_lifecycle_manager",
                            executable="lifecycle_manager",
                            namespace=namespace,
                            name="localization_lifecycle_manager",
                            parameters=[
                                {
                                    "use_sim_time": True,
                                    "autostart": True,
                                    "node_names": ["amcl"],
                                }
                            ],
                            condition=condition,
                            output="screen",
                        )
                    ],
                ),
            ]
        )
        traffic_nodes.append(
            TimerAction(
                period=3.0 + index * 0.15,
                actions=[
                    Node(
                        package="my_first_bot",
                        executable="spawn_localized_vehicle.py",
                        name=f"spawn_{name}",
                        parameters=[
                            {
                                "entity": name,
                                "robot_namespace": f"/{namespace}",
                                "template": str(traffic_model),
                                "x": x,
                                "y": y,
                                "z": 0.3,
                                "yaw": yaw,
                                "random_start": randomize_starts,
                                "map_yaml": map_yaml,
                                "spawn_index": index - 1,
                                "vehicle_count": vehicle_count,
                                "random_seed": spawn_seed,
                            }
                        ],
                        condition=condition,
                        output="screen",
                    )
                ],
            )
        )

    return LaunchDescription(
        [
            DeclareLaunchArgument("gui", default_value="true"),
            DeclareLaunchArgument("use_web", default_value="true"),
            DeclareLaunchArgument("use_rviz", default_value="false"),
            DeclareLaunchArgument(
                "world",
                default_value=str(package_share / "worlds" / "newwarehouse.world"),
            ),
            DeclareLaunchArgument(
                "map",
                default_value=str(
                    package_share / "maps" / "my_warehouse_map_new1.yaml"
                ),
            ),
            DeclareLaunchArgument(
                "map_image",
                default_value=str(
                    package_share / "maps" / "my_warehouse_map_new1.png"
                ),
            ),
            DeclareLaunchArgument(
                "uwb_tag_config",
                default_value=str(package_share / "config" / "uwb_tags.yaml"),
            ),
            DeclareLaunchArgument("traffic_profile", default_value="newwarehouse"),
            DeclareLaunchArgument("database", default_value="~/.ros/newwarehouse_traffic.db"),
            DeclareLaunchArgument("web_port", default_value="8080"),
            DeclareLaunchArgument("vehicle_count", default_value="8"),
            DeclareLaunchArgument(
                "traffic_speed",
                default_value="1.2",
                description="Maximum simulated vehicle speed in metres per second",
            ),
            DeclareLaunchArgument("uwb_range_noise", default_value="0.10"),
            DeclareLaunchArgument("uwb_dropout_rate", default_value="0.05"),
            DeclareLaunchArgument("uwb_maximum_range", default_value="45.0"),
            DeclareLaunchArgument("uwb_confirm_threshold", default_value="0.5"),
            DeclareLaunchArgument("uwb_warning_threshold", default_value="1.0"),
            DeclareLaunchArgument("uwb_max_pair_skew", default_value="0.35"),
            DeclareLaunchArgument("uwb_validation_hysteresis", default_value="0.10"),
            DeclareLaunchArgument("uwb_problem_samples", default_value="3"),
            DeclareLaunchArgument("uwb_recovery_samples", default_value="3"),
            DeclareLaunchArgument(
                "randomize_starts",
                default_value="true",
                description="Spawn traffic vehicles at safe random free-map positions",
            ),
            DeclareLaunchArgument(
                "spawn_seed",
                default_value=str(int(time.time())),
                description="Random spawn seed; set a fixed value for repeatable starts",
            ),
            DeclareLaunchArgument(
                "use_uwb_startup",
                default_value="true",
                description="Initialize traffic AMCL x/y once from UWB",
            ),
            IncludeLaunchDescription(
                PythonLaunchDescriptionSource(str(full_sim)),
                launch_arguments={
                    "world": world,
                    "map": map_yaml,
                    "map_image": map_image,
                    "spawn_robot": "false",
                    "gui": gui,
                    "use_web": use_web,
                    "use_rviz": use_rviz,
                    "database": database,
                    "web_port": web_port,
                    "vehicle_count": vehicle_count,
                    "traffic_speed": traffic_speed,
                    "traffic_profile": traffic_profile,
                    "traffic_pose_source": "amcl",
                    "uwb_range_noise": uwb_range_noise,
                    "uwb_dropout_rate": uwb_dropout_rate,
                    "uwb_maximum_range": uwb_maximum_range,
                    "uwb_tag_config": uwb_tag_config,
                    "uwb_confirm_threshold": uwb_confirm_threshold,
                    "uwb_warning_threshold": uwb_warning_threshold,
                    "uwb_max_pair_skew": uwb_max_pair_skew,
                    "uwb_validation_hysteresis": uwb_validation_hysteresis,
                    "uwb_problem_samples": uwb_problem_samples,
                    "uwb_recovery_samples": uwb_recovery_samples,
                }.items(),
            ),
            Node(
                package="pointcloud_to_laserscan",
                executable="pointcloud_to_laserscan_node",
                name="warehouse_pointcloud_to_scan",
                remappings=[("cloud_in", "/points"), ("scan", "/scan")],
                parameters=[
                    {
                        "use_sim_time": True,
                        "target_frame": "lidar_link",
                        "min_height": 0.10,
                        "max_height": 0.50,
                        "angle_min": -3.14159,
                        "angle_max": 3.14159,
                        "angle_increment": 0.0087,
                        "scan_time": 0.1,
                        "range_min": 0.4,
                        "range_max": 12.0,
                        "use_inf": True,
                    }
                ],
                output="screen",
            ),
            Node(
                package="my_first_bot",
                executable="uwb_amcl_initializer.py",
                name="uwb_amcl_initializer",
                parameters=[
                    {
                        "use_sim_time": True,
                        "vehicle_count": vehicle_count,
                        "include_main_vehicle": True,
                        "main_vehicle_id": "my_robot",
                        "minimum_tags": 3,
                        "yaw_variance": 9.8696,
                    }
                ],
                condition=IfCondition(use_uwb_startup),
                output="screen",
            ),
            *traffic_nodes,
        ]
    )
